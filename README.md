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

### Queues

A queue is an entity that has multiple input channels and one or more output channels. Unlike an action, a queue
fires as soon as it gets a token from _any_ of its inputs, and consumes exactly one token per fire, without
discharging the other inputs.

A queue is implemented as follows:
*   Inputs to the queue are attached to Action A as inhibitors.
*   Action A has two outputs: one attached to Action B as an inhibitor, one attached to Action C as an inhibitor.
*   Action B has one output, attached as a non-inhibiting input to Action C.
*   The output of Action C is the output of the entity.

```
> *--()--x A    // Indicates that an arbtirary number of input channels are each
                // connected as inhibitors to action A.
                // The delay of the channels is not unspecified.
A --(N)--x B    // Indicates that an output channel from action A connects
                // as an inhibitor to action B, with a channel delay of N.
A --(N)--x C
B --(N+K)-- C   // Indicates that an output channel from Action B connects
                // as a non-inhibiting input to action C with a channel delay which
                // is no less than N.
C *--()-- >     // Indicates that any number of output channels can be attached to
                // action C.
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


