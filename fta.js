// Free Token Analysis

const CHANNEL_STATE_FREE = 'F';
const CHANNEL_STATE_CHARGING = 'C';
const CHANNEL_STATE_READY = 'R';

const CHANNEL_BOUND = 'bound';
const CHANNEL_UNBOUND_IN = 'unbound-input';
const CHANNEL_UNBOUND_OUT = 'unbound-output';

class Channel {
  constructor({type = CHANNEL_BOUND, state = CHANNEL_STATE_FREE} = {}) {
    this._type = type;
    this._bounded = type === CHANNEL_BOUND;
    this._state = state;
  }

  getState() {
    if (!this._bounded) {
      return `${this._state}*`;
    }
    return this._state;
  }

  discharge() {
    if (this._state === CHANNEL_STATE_READY) {
      this._state = CHANNEL_STATE_FREE;
    }
  }

  charge() {
    if (this._state === CHANNEL_STATE_FREE) {
      this._state = CHANNEL_STATE_CHARGING;
    }
  }

  isFree() {
    return this._state === CHANNEL_STATE_FREE;
  }

  isReady() {
    return this._state === CHANNEL_STATE_READY;
  }

  isUnstable() {
    return this._state === CHANNEL_STATE_CHARGING
      || (this._type === CHANNEL_UNBOUND_IN && this._state === CHANNEL_STATE_FREE)
      || (this._type === CHANNEL_UNBOUND_OUT && this._state === CHANNEL_STATE_READY);
  }

  next() {
    if (this._state === CHANNEL_STATE_CHARGING) {
      return new Channel({type: this._type, state: CHANNEL_STATE_READY});
    }
    else if(this._type === CHANNEL_UNBOUND_IN) {
      if (this._state === CHANNEL_STATE_FREE) {
        return new Channel({type: this._type, state: CHANNEL_STATE_CHARGING});
      }
    }
    else if(this._type === CHANNEL_UNBOUND_OUT) {
      if (this._state === CHANNEL_STATE_READY) {
        return new Channel({type: this._type, state: CHANNEL_STATE_FREE});
      }
    }
    return new Channel({type: this._type, state: this._state});
  }
}

class ActionFactory {
  constructor({inputs = [], inhibitors = [], outputs = []} = {}) {
    this._inputs = inputs;
    this._outputs = outputs;
    this._inhibitors = inhibitors;
  }

  getAction(channels) {
    return new Action({
      inputs: this._inputs.map((i) => channels[i]),
      inhibitors: this._inhibitors.map((i) => channels[i]),
      outputs: this._outputs.map((i) => channels[i]),
    });
  }
}

class Action {
  constructor({inputs = [], inhibitors = [], outputs = []} = {}) {
    this._inputs = inputs;
    this._outputs = outputs;
    this._inhibitors = inhibitors;
  }

  evaluate() {
    if (this.isFree() && this.isActivated()) {
      const state = this._getStateValue();
      this._inputs.forEach((c) => c.discharge());
      this._inhibitors.forEach((c) => c.discharge());
      if (!this.isInhibited()) {
        this._outputs.forEach((c) => c.charge());
        if (this._getStateValue() !== state) {
          return 1 + this.evaluate();
        }
        return 1;
      }
      else {
        if (this._getStateValue() !== state) {
          return this.evaluate();
        }
      }
    }
    return 0;
  }

  getStateDetails() {
    return {
      free: this.isFree(),
      activated: this.isActivated(),
      isInhibited: this.isInhibited()
    };
  }

  _getStateValue() {
    return [this.isFree(), this.isActivated(), this.isInhibited()]
      .map((f) => f ? 1 : 0)
      .reduce((prev, b) => {
        const val = prev.val;
        const factor = prev.factor;
        return {
          val: val + (b*factor),
          factor: factor*2
        };
      }, {val: 0, factor: 1}).val;
  }

  isFree() {
    return this._outputs.every((c) => c.isFree());
  }

  isActivated() {
    return this._inputs.every((c) => c.isReady());
  }

  isInhibited() {
    return this._inhibitors.some((c) => c.isReady());
  }
}

function getSystemState(channels) {
  return channels.map((c) => c.getState()).join('');
}

function evaluateSystemState(action, channels) {
  const initialState = getSystemState(channels);
  const fireCount = action.evaluate();
  const finalState = getSystemState(channels);
  console.log(getSystemState(channels), act_A.getStateDetails());
}

function getPossibleNextChannels(channels) {
  if (channels.length === 0) {
    return [[]];
  }
  const firstChannel = channels[0];
  const remainingChannels = channels.slice(1);
  const subStates = getPossibleNextChannels(remainingChannels);
  const withUnchanged = subStates.map((sub) => [firstChannel].concat(sub));
  if (firstChannel.isUnstable()) {
    const next = firstChannel.next();
    const withChanged = subStates.map((sub) => [next].concat(sub));
    return withUnchanged.concat(withChanged);
  }
  else {
    return withUnchanged;
  }
}

function analyzeFromState(knownStates, actionFactory, prevState, channels) {
  const transientState = getSystemState(channels);
  const action = actionFactory.getAction(channels);
  const fireCount = action.evaluate();
  const settledState = getSystemState(channels);
  console.log(`${prevState} --(${transientState} / ${fireCount})--> ${settledState}`);

  if (!knownStates[settledState]) {
    knownStates[settledState] = true;
    getPossibleNextChannels(channels).forEach((newChannels) => {
      if (getSystemState(newChannels) !== settledState) {
        analyzeFromState(knownStates, actionFactory, settledState, newChannels);
      }
    });
  }
}

(function main() {
  const ch_AxA = new Channel()
  const ch_AO = new Channel({type: CHANNEL_UNBOUND_OUT});
  const channels = [ch_AxA, ch_AO];
  const act_A = new ActionFactory({
    inhibitors: [0],
    outputs: [0, 1]
  });

  const knownStates = {}
  analyzeFromState(knownStates, act_A, '<init>', channels);

})();