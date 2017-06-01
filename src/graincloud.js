import React, { Component } from 'react';
import numeric from 'numeric';
import Slider from 'rc-slider';
import ParameterBox from './parametercontrol';
import EnvelopePicker from './envelopes';
import { WaveformGrainSource, SampleGrainSource } from './grainsources';

function grainCloud(GrainSource) {
  return class GrainCloud extends Component {
    constructor(props) {
      super(props);
      this.controlFunctions = {};
      this.state = { grainDensity: 10 // grains/s
                   , grainDuration: 0.03 // s
                   , playing: false
                   , gain: 1
                   };
    }
    componentDidUpdate(prevProps, prevState) {
      if (prevState.playing !== this.state.playing) {
        if (this.state.playing) {
          this.playCloud();
        } else {
          this.stopCloud();
        }
      } else if (this.state.playing && prevState.grainDensity !== this.state.grainDensity) {
        // reset the interval when density changes
        this.stopCloud();
        this.playCloud();
      }
    }
    componentWillUnmount() {
      this.stopCloud();
    }
    render() {
      const playButtonTxt = this.state.playing ? '\u25a0' : '\u25ba';
      const playhalp = this.state.playing ? 'Stop playing this grain cloud.' : 'Play this grain cloud.';
      const remhalp = 'Remove this grain cloud.';
      const densehalp = 'Continuing with the cloud metaphor, grain density is how close together grains are packed. More specifically, it is the number of times per second a grain gets created.';
      const durhalp = 'How long each grain lasts, in milliseconds.';
      const volumehalp = 'The volume of this cloud.';
      const moreProps = { addControlFunction: (id,fn) => this.addControlFunction(id,fn)
                        , removeControlFunction: id => this.removeControlFunction(id)
                        };
      const props = Object.assign({}, moreProps, this.props, this.state);
      return (
        <div className="grainCloud">
          <div className="cloudControls">
            <button type="button"
                    onMouseEnter={() => this.props.changeHelpText(playhalp)}
                    onClick={() => this.changePlaying()}>{playButtonTxt}</button>
            <div onMouseEnter={() => this.props.changeHelpText(volumehalp)}>
              <Slider min={0}
                      max={2}
                      step={0.1}
                      defaultValue={this.state.gain}
                      onChange={gain => this.changeGain(gain)} />
            </div>
            <button className="removeCloud"
                    type="button"
                    onMouseEnter={() => this.props.changeHelpText(remhalp)}
                    onClick={this.props.removeCloud}>[x]</button>
          </div>
          <GrainSource
            ref={gs => this.grainSource = gs}
            {...props} />
          <ParameterBox
            label={"Grain density"} // unicode hex 2374
            value={this.state.grainDensity}
            min={1}
            max={100}
            step={0.1}
            onChange={d => this.changeGrainDensity(d)}
            helpText={densehalp}
            {...props} />
          <ParameterBox
            label="Grain duration"
            value={this.state.grainDuration*1000}
            min={1}
            max={100}
            helpText={durhalp}
            onChange={dur => this.changeGrainDuration(dur)}
            {...props} />
          <EnvelopePicker
            ref={env => this.envelope = env}
            {...props} />
        </div>
      );
    }
    changePlaying() {
      this.setState({ playing: !this.state.playing });
    }
    changeGrainDensity(d) {
      this.setState({ grainDensity: d });
    }
    changeGrainDuration(dur) {
      this.setState({ grainDuration: dur/1000 });
    }
    changeGain(gain) {
      this.setState({ gain: gain });
    }
    addControlFunction(id, fn) {
      this.controlFunctions[id] = fn;
    }
    removeControlFunction(id) {
      delete this.controlFunctions[id];
    }
    generateGrainEnvelope() {
      const grain = this.grainSource.makeGrain();
      const env = this.envelope.generate(grain);
      for (let ch=0; ch<grain.numberOfChannels; ch++) {
        const chanBuff = grain.getChannelData(ch);
        grain.copyToChannel(Float32Array.from(numeric.mul(env,chanBuff)), ch);
      }

      const src = this.props.audioCtx.createBufferSource();
      src.buffer = grain;
      const gainNode = this.props.audioCtx.createGain();
      gainNode.gain.value = this.state.gain;
      src.connect(gainNode);
      // pass in src for last-minute manipulations by grainSource
      const connector = this.grainSource.getConnector(src);
      gainNode.connect(connector);
      connector.connect(this.props.audioCtx.destination);
      src.start();
    }
    callControlFunctions() {
      for (let id in this.controlFunctions) {
        if (this.controlFunctions.hasOwnProperty(id)) {
          this.controlFunctions[id]();
        }
      }
    }
    playCloud() {
      this.intervalId = window.setInterval(() => {
        this.callControlFunctions();
        this.generateGrainEnvelope();
      }, 1000/this.state.grainDensity);
      const animationFunc = () => {
        this.animation = window.requestAnimationFrame(animationFunc);
        this.grainSource.drawViz();
      }
      animationFunc();
    }
    stopCloud() {
      window.clearInterval(this.intervalId);
      this.animation = window.cancelAnimationFrame(this.animation);
      this.grainSource.resetViz();
      this.callControlFunctions();
    }
  }
}

export const WaveformGrainCloud = grainCloud(WaveformGrainSource);
export const SampleGrainCloud = grainCloud(SampleGrainSource);
