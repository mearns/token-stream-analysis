# Token Stream Analysis

This is something I'm working on as a way of describing and analyzing systems, particularly
asynchronous systems which communicate via some kind of messaging (although I suspect the
concept of "messaging" can be general enough to include things like function calls).

It's inspired initally by some vague recollections I have from my asynchronous logic
class during grad school, so it's possible this work has already been done, and if so
it's probably been done better. If you know of such work, please let me know (consider
creating an issue on github).

## Definition of System Elements

A system is composed primarily of: actions, actors, channels. Additional elements include
finite sources, buffers, and queues (at least some of these are simply syntactic sugar and can actually be
implemented using the primary elements mentioned above).

Another important aspect of the analysis are **tokens**. These are not actually a part of
the system, but represent signalling with the system.

In brief:

*   **actions** are things that can occur in the system. From the perspective of the
    model, they produce and consume tokens when they occur.
*   **actors** are collections of actions that occur in synchronization.
*   **channels** are how tokens are exchanged between actions. They connect ports.

### Overview

We will consider a discrete time system whose instances are enumerated by the natural numbers. To
consider continuous time, we can make the interval between these instances arbitrarily small.

#### Action

At every instance of time, an action does the following:

```
if (<all output channels free>) {                      // condition 1 (free)
  if (<all non-inhibiting input channels are charged>) {    // condition 2 (activate)
    if (<all inhibiting input channels are uncharged>) {    // condition 3 (uninhibited)
      <feed token to each output channels>
    }
    <discharge all input channels (inhibiting and non-inhibiting)>
  }
}
```

An action is considered **free** if and only if it satisfies condition 1 (all output channels are
uncharged, so it is _free_ to act again).

An action is considered **activated** if and only if it satisfies condition 2 (all non-inhibiting
input channels are charged).

An action is considered **uninhibited** if and only if it satisfies condition 3 (all inhibiting input
channels are uncharged).

An action is considered **ready** if and only if it is both _activated_ and _uninhibited_.

An action is considered to be **firing** if and only if is both _ready_ and _free_. The state of being
_firing_ is instantaneous as a _free_ and _activated_ action discharges all of it's inputs, therefore
becoming deactivated. Further more, a _firing_ action will charge all of its outputs, therefore becoming
unfree.

An action that is _free_ and _activated_ but _inhibited_ is called **consuming**: it discharges all
of it's input channels, but does not feed its output channels.

An action is considered to be **waiting** if and only if it is _ready_ but not _free_.

Note that when "all" is applied to an empty set, it is true, because all(p) is the same as
saying !some(!p). Thus an action with no input channels will always be _ready_ and will charge
its output channels as soon as it is freed (such an action is considered an _infinite source_).
Similarly, a channel with no output channels is always _free_ and can discharge its input channels
as soon as it is _activated_ (such an action is considered an _inifinite sink_).

An _infinite source_ with exactly one output channel is called a _fountain_: it provides tokens to
it output channel as quickly as they are consumed.

An _inifinite sink_ with exactly one input is called a _black hole_: it consumes tokens as quickly
as they are provided.

#### Channels

A channel represents not only communications between two actions, but also the production of that
communcation. A channel is said to be _owned by_ its input action (to which it is an _output channel_),
because it represents computation associated with that action. A token provided to the channel by
its input action is simply a trigger to tell it to begin it's computation. The channel does not actually
produce an output token until the computation is complete, some finite amount of time later.

A channel exists in one of three states: free, charging, and charged. All channels start in the free
state. Supplying a token ("activating") to the channel from its input action transitions a free channel
to a charging channel. After some finite amount of time, a charging channel automatically transitions
to the charged state. Consuming a token from a channel (via it's output action) transitions it back
to the free state.

Additionally, there are two derived properties of a channel: _charged_ and _active_. A channel is **charged**
if and only if it is in the _charged_ state, otherwise it is **uncharged**. A channel is **active** if and
only if it is not in the _free_ state, otherwise it is **inactive**.

Only a _charged_ channel can provide a token to its output action. Only a _free_ token can accept a token
from its input input action. A channel in the _charging_ state can neither accept nor provide tokens.

Lastly, a third dervied property is _stable_. A channel is **stable** if and only if it is not in the _charging_
state, otherwise it is **unstable** (aka, **charging**). An _unstable_ channel will eventually progress to
being a _stable_ channel wihtout any intervention required (specifically, it will become _charged_).

Currently, we will restrict all channels to have a non-zero charge time. This may or may not prove necessary.

### Finite Sources

A finite source is an action which is essentially pre-loaded with a finite number of tokens, which it can
provide as quickly as it is freed until it runs out, at which point it cannot provide any additional tokens.

A finite source of one token can be implemented as an action with only one input channel, which must be an inhibiting
channel, and an output channel that feeds this inhibiting channel. Since there are no non-inhibiting inputs,
this action will always be _activated_. Since its outputs are initially uncharged it will initially be _free_,
and since one of its outputs feeds its inhibiting input, this inhibitor will also be uncharged initially, so
the action will be both _ready_ as well. This will cause the action to _fire_ immediately, at which point
it's inhibitor will be _uncharged_ and eventually _charged_, preventing it from firing further.

TK: What about charge time for the channel? Can it provide other tokens in the mean time? No, because the
output channel is not free. I think.

### P-Queues

A p-queue is an entity that has multiple input channels and one or more output channels. Unlike an action, a queue
fires as soon as it gets a token from _any_ of its inputs, and consumes exactly one token per fire, without
discharging the other inputs.

A queue is implemented as follows:
*   Inputs to the queue are attached to Action A as inhibitors.
*   Action A has two outputs: one attached to Action B as an inhibitor, one attached to Action C as an inhibitor.
*   Action B has one output, attached as a non-inhibiting input to Action C.
*   The output of Action C is the output of the entity.

```
entity p-queue (<I* >O*) {    // indicates that the entity can take an arbitrary number of inputs, collectively
                            // called "I", and an arbitrary number of outputs, collectively called "O"
  I[*] ----x A    // Indicates that an arbtirary number of input channels are each
                  // connected as inhibitors to action A.
                  // The delay of the channels is not unspecified.
  A --(N)--x B    // Indicates that an output channel from action A connects
                  // as an inhibitor to action B, with a channel delay of N.
  A --(N)--x C
  B --(N+K)-- C   // Indicates that an output channel from Action B connects
                  // as a non-inhibiting input to action C with a channel delay which
                  // is no less than N.
  C ---- O[*]     // Indicates that any number of output channels can be attached to
                  // action C.
}
```

Analysis as follows:
*   At initialization, actions A and B are immediately _activated_ because they have
    no non-inhibiting inputs. Because all channels are initially uncharged, these
    actions are also _uninhibited_ and _free_, so the actions _fire_ immediately,
    charging up channel AxB, AxC, and BC.
*   At time N, channels AxB and AxC are charged, putting actions A and C into
    an inhibited state. Action B is not _free_ (because BC is charging), so it cannot
    _fire_. Action C is not yet _activated_ because BC is not yet charged.
*   At time N+K, channel BC is charged, which _activates_ action C, although it is
    still _inhibited_ by AxC. Action C is also _free_, so it _consumes_ tokens
    off of AxC and BC. Consuming _BC_ frees up action B, which makes action B
    _consuming_, so it consumes the token from AxB. Since action C also consumed
    a token from AxC, this leaves action A _free_, and since it's always _activated_
    and is not currently inhibited, action A _fires_ in the same instance, charging
    up AxB and AxC. Charging of both channels will complete at time 2N+K.
*   In the same instance, Action B fires because it is now _free_ and _uninhibited_;
    this leads to channel BC being charged. Charge will complete at time 2N+2K).
*   At time 2N+K, channels AxB and AxC are charged, inhibiting actions B and C.
    Action B is still charging (channel BC), and action C is unactivated (input BC
    is charging).
*   At time 2N+2K, channel BC is charged, which makes action C _activated_, but it is
    still _inhibited_ by AxC, so it cannot fire. This brings us back to the exact
    same state that we were in at time N+K: channels AxB, AxC, and BC are all charged.
    So if no additional tokens come into the system through I, we will continue through
    this loop, and the queue will not output any tokens.
*   At some point, one of the input channels to the queue becomes charged. This causes
    Action A to become inhibited. The next time that channel BC becomes charged, leading
    Action C to consume a token off of AxC and causing B to consume a token off of
    AxB and immediately fire a token onto BC to start charging it, Action A becomes
    _free_ but _inhibited_. With no non-inhibiting inputs, Action A is always _activated_,
    so this causes Action A to be _consuming_, and it consumes the token off of the input.
    TK: ??? How does it cause action C to fire?

### Races

A race is an entity that provides 1 token to exactly 1 of N channels, which-ever channel is free
first. If both are free when the token becomes available, it provides the token to exactly
one channel, chosen on an abirtrary (and non-deterministic) basis.

It may be implemented as follows (TK: unconfirmed):

```
entity race-2 (<I >O,P) {
  I ---- D
  D --(L)-- L
  D --(L)-- R
  L --(M)--x R
  R --(M)--x L
  L --(N)-- O
  R --(N)-- P
end
```

### Finite Buffer

A finite buffer can consume a specified number of tokens from a single input channel
before blocking that input channel. It can subsequently provide these tokens to an
output channel. It's a way for one action to burst fire a a bunch of tokens to
a downstream action faster than that action can consume them, without the first
action getting blocked.

An n-buffer can be implemented (TK: unconfirmed) as N actions chained together, each
with a single non-impeding input and a single output.

## Analysis of Systems

Stable channels (channels that are either _free_ or _charged_) do not cause changes
in a system. Changes in a system are only instigated by the transition of a _charging_ channel to
a _charged_ channel. Therefore, the only instances of time that matter in the analysis of the
system are instances in which a channel makes such a transition.

Also note that actions have no state of their own; their only function is to connect
channels together. Therefore, the entire state of the system is defined by the state of
its channels.

For analysis, we therefore only need to consider the states of the channels (properly
connected as determined by the actions), and only at instances when they transition from
_charging_ to _charged_. The result of such a transition may cause actions to become _activated_,
which may change the state of channels in the system: from _charged_ to _free_ (the channel's
token is consumed) or from _free_ to _charging_ (the channel is fed a token from a firing
action).

One approach to analyzing the system is to build a directed graph of all possible states of the system,
where a node in the graph represents a state, and node Y is a direct successor of a node X if the state
represented by Y can possibly occur in the next instance after the system is in the state represented
by X.

In a brute-force approach, we can consider in each state the set of all channels that are in the
_charging_ state (that is, unstable). At the next instance, any combination of these channels could
(conceivably) transition to _charged_; any such combination would lead to a next state (although it
may be that some of these states are identical). If there are N _charging_ channels, then we can
say our choice of next state is represented by an N bit string, where each bit is 1 if the corresponding
channel transitions to _charged_ in the next moment, and 0 otherwise, leading to $2^N$ possible transitions
out of the state, and a maximum of $2^N$ possible next states.

A system with C channels has a maximum number of possible states of 3^C, so the graph above is strictly
finite, though it may be impractically large.

If there are restrictions places on the channels (e.g., to say that a certain channel charges in a certain
amount of time, or that a certain channel always takes longer to charge than another channel), then many of
the possible states may not actually be reachable.

The above applies to closed systems. For open systems (where tokens can arrive on input channels or be consumed
from output channels spontaneously), the rules for possible next states from any given state is increased.
Specifically, an open input channel can spotaneously transition from _free_ to _charging_, as well as from _charging_
to _charged_; and an open output channel can spotaneously transition from _charged_ to _free_, as well as from
_charging_ to _charged_.

We will consider the analysis of a single-token bank:

```
entity bank-1 (<O) {
  A --x A
  A -- O
}
```

This has a single action, A, and two channels, AxA and AO. AxA is an inhibiting input channel to A, and also
an output chanell to A. AO is an output channel of A.

We will designate the state of this system as a two-tuple of the states of the two channels: `(AxA, AO*)`.
The star on `AO*` simply highlights that this is an open output channel and can therefore spontaneously
transition from _charged_ to _free_. For convenience, we will refer to the _charged_ state as _ready_ as well,
and we will denote the three possible states of a channel as `F` for _free_, `C` for _charging_ and `R` for _ready_, or _charged_.

With two channels, there are a maximum number of possible states of $3^2 = 9$. We will see that only 7 of these
states are actually reachable, and that 1 of these 7 is actually a transient state which can only exist instanteously.

To begin with, we note that since action A has no non-inhibiting inputs, it is always _activated_. In order to _consume_,
it must also be _uninhibited_ by AxA. In order to _fire_, it must further be _free_ by having channel AO be _free_. We can
summarize the states of action A as follows:

```
AxA AO  A-ready A-free  A
F   F   1       1       firing
F   C   1       0       not-free
F   R   1       0       not-free
C   F   1       0       not-free
C   C   1       0       not-free
C   R   1       0       not-free
R   F   0       0       not-free
R   C   0       0       not-free
R   R   0       0       not-free
```

At initialization, all channels are _free_, so at t0 we have `(F, F*)` which puts action A immediately
into the _firing_ state. This firing causes both channels to become _charging_, putting us into an initial
state `(C, C*)`, and putting action A into a _waiting_ state (activated, uninhibited, but not free).
Note that we refer to state `(F, F*)` as _transient_, because the system cannot persist in this state for
any amount of time: it will always transition to the `(C, C*)` _settled_ state within the same instance.

From `(C, C*)`, either channel, or both channels, could transition to ready, so our graph forks out in
three ways, to `(R, C*)`, `(C, R*)`, and `(R, R*)`.

In `(R, C*)`, action A is _activated_, but not _free_ (and also _inhibited_), so we do not fire; this is a _settled_
state of the system (meaning it will be in this state at least until the next instance). From this
state, AxA cannot spontaneously transition, but AO is still charging, so it can spotaneously transition
to _ready_, which means this state goes to `(R, R*)`, which we will pursue later.

In `(C, R*)`, action A is _ready_, but not _free_, so it cannot fire; this is again a _settled_
state. From this state, AxA can transition to _ready_, and since AO is an open channel, it can transition
spotaneously from `R*` to `F*`. We could also have both of these transitions happen at once. Therefore our
next set of possible states is `(R, R*)`, `(C, F*)`, and `(R, F*)`. Since this is now the third time
that `(R, R*)` has shown up, lets address that next.

In state `(R, R*)`, action A is _activated_ only: it is _inhibited_ by AxA, and also blocked, by both AO
and AxA, so it cannot fire, making this a settled state. AxA cannot transition spotaneously out of the
_ready_ state, but since AO is an open channel, it can spontaneously transition from `R*` to `F*`,
which makes our only possible next state `(R, F*)`.

Going back to `(C, F*)`, we find that action A is _unfree_ because AxA is not _free_, so this is another
settled state. `F*` cannot transition spontaneously, but AxA can spontaneously trasition from _charging_
to _ready_, so the only possible next state is `(R, F*)`.

The only other state that we've seen so far is `(R, F*)`. In this state, action A is _unfree_ because AxA is
charged, so this is a _settled_ state. Notice that neither AxA in the _ready_ state, nor AO in the _free_ state
can spontaneously tranisition, so there are no possible future states. This is called a _sink_, or a _basin_, and
it represents a terminal state of the system: once it reaches this state it will always be in this state.

We can represent our state graph as follows:

```
<init> --> CC*
CC* --> [RC*, CR*, RR*]
RC* --> RR*
CR* --> RR*, CF*, RF*
RR* --> RF*
CF* --> RF*
```

If you draw out the graph, you can see that all states eventually end up at `RF*`, so this is not only a
terminal state of the system, it is the _only_ terminal state of the system. Also notice that there was only
one occassion in which our action A fired, which it right at initialization, when it began charging up AO.
This is why this entity acts as a single-token bank: it provides a single token at initialization and then reaches
a terminal state from which it cannot leave, and therefore cannot create any additional tokens.
