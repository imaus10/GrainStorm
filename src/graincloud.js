import React, { Component } from 'react';
import ParameterBox from './parametercontrol';
import EnvelopePicker from './envelopes';
import { WaveformGrainSource, SampleGrainSource } from './grainsources';
import numeric from 'numeric';

function grainCloud(GrainSource) {
  return class GrainCloud extends Component {
    constructor(props) {
      super(props);
      this.controlFunctions = {};
      this.state = { grainDensity: 10 // grains/s
                   , grainDuration: 0.03 // s
                   , playing: false
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
      const moreProps = { addControlFunction: (id,fn) => this.addControlFunction(id,fn)
                        , removeControlFunction: id => this.removeControlFunction(id)
                        };
      const props = Object.assign({}, moreProps, this.props);
      return (
        <div className="grainCloud">
          <div>
            <button type="button"
                    onMouseEnter={() => this.props.changeHelpText(playhalp)}
                    onClick={() => this.changePlaying()}>{playButtonTxt}</button>
            <button className="removeCloud"
                    type="button"
                    onMouseEnter={() => this.props.changeHelpText(remhalp)}
                    onClick={this.props.removeCloud}>[x]</button>
          </div>
          <GrainSource
            ref={gs => this.grainSource = gs}
            {...this.state}
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
            {...this.state}
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
      this.grainSource.playGrain(src);
    }
    playCloud() {
      this.intervalId = window.setInterval(() => {
        this.generateGrainEnvelope();
        for (let prop in this.controlFunctions) {
          if (this.controlFunctions.hasOwnProperty(prop)) {
            this.controlFunctions[prop]();
          }
        }
        // this.applyMetaControl();
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
    }
  }
}

export const WaveformGrainCloud = grainCloud(WaveformGrainSource);
export const SampleGrainCloud = grainCloud(SampleGrainSource);
