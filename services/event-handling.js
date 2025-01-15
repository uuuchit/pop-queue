const EventEmitter = require('events');

class EventHandling extends EventEmitter {
  constructor() {
    super();
  }

  emitEvent(event, data) {
    this.emit(event, data);
  }

  onEvent(event, listener) {
    this.on(event, listener);
  }

  offEvent(event, listener) {
    this.off(event, listener);
  }

  registerEventListeners(eventListeners) {
    for (const [event, listener] of Object.entries(eventListeners)) {
      this.on(event, listener);
    }
  }
}

module.exports = EventHandling;
