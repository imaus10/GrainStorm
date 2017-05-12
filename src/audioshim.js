if (typeof window.AudioBuffer.prototype.copyToChannel !== 'function') {
  window.AudioBuffer.prototype.copyToChannel = function(source, channelNumber, startInChannel=0) {
    const dest = this.getChannelData(channelNumber);
    dest.set(source, startInChannel);
  }
}

if (typeof window.AudioBuffer.prototype.copyFromChannel !== 'function') {
  window.AudioBuffer.prototype.copyFromChannel = function(destination, channelNumber, startInChannel=0) {
    const source = this.getChannelData(channelNumber).subarray(startInChannel, startInChannel+destination.length);
    destination.set(source);
  }
}

// TODO: AudioBufferSourceNode.detune
