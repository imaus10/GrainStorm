import React, { Component } from 'react';
import numeric from 'numeric';
import Slider from 'rc-slider';
import Parameter from './Parameter';
import EnvelopePicker from './Envelopes';
import { WaveformGrainSource, SampleGrainSource } from './GrainSources';

// a higher order component (HOC) that keeps the parameters common
// to all GrainSources while allowing for extra parameters to be
// defined within each particular GrainSource.
// this HOC mainly does two things:
// 1. generates and plays grains with a time interval between each grain
// 2. applies control functions before each new grain
// See playCloud() and generateAndPlayGrain().
function grainCloud(GrainSource) {
  return class GrainCloud extends Component {
    // React methods:
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
          // reset controlled parameters to start value
          this.callControlFunctions();
        }
      } else if (this.state.playing && prevState.grainDensity !== this.state.grainDensity) {
        // reset the interval (window.setInterval in playCloud) when density changes
        this.stopCloud();
        this.playCloud();
      }
    }
    componentWillUnmount() {
      this.stopCloud();
    }
    render() {
      const playBtnTxt = this.state.playing ? '\u25a0' : '\u25ba';
      const playBtnCls = 'glow' +
                         (this.props.walkthru === 1 ? ' glimmer' : '');
      const playBtnClickFunc = () => {
        if (this.props.walkthru === 1) {
          this.props.bumpWalkthru();
        }
        this.changePlaying();
      };

      const moreProps = { addControlFunction: (id,fn) => this.addControlFunction(id,fn)
                        , removeControlFunction: id => this.removeControlFunction(id)
                        };
      const props = Object.assign({}, moreProps, this.props, this.state);
      return (
        <div className="grainCloud">
          <div className="cloudControls">
            <button type="button"
                    className={playBtnCls}
                    onClick={playBtnClickFunc}>{playBtnTxt}</button>
              <Slider min={0}
                      max={2}
                      step={0.1}
                      defaultValue={this.state.gain}
                      onChange={gain => this.changeGain(gain)} />
            <button type="button"
                    className="removeCloud glow"
                    disabled={props.walkthru !== -1}
                    onClick={this.props.removeCloud}>X</button>
          </div>
          <GrainSource
            ref={gs => this.grainSource = gs}
            {...props} />
          <Parameter
            label={"Grain density"} // unicode hex 2374
            value={this.state.grainDensity}
            min={1}
            max={100}
            step={0.1}
            onChange={d => this.changeGrainDensity(d)}
            walkthruReveal={2}
            {...props} />
          <Parameter
            label="Grain duration"
            value={this.state.grainDuration*1000}
            min={1}
            max={100}
            onChange={dur => this.changeGrainDuration(dur)}
            walkthruReveal={3}
            {...props} />
          <EnvelopePicker
            ref={env => this.envelope = env}
            {...props} />
        </div>
      );
    }

    // methods that call setState
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

    // these two methods are passed down to all child components
    // so that this HOC can abstractly call the control functions
    // before each grain generation, while the child component handles
    // the implementation of the actual functions.
    // see Parameter.js for Control components.
    addControlFunction(id, fn) {
      this.controlFunctions[id] = fn;
      fn(); // call to set initial param
    }
    removeControlFunction(id) {
      delete this.controlFunctions[id];
    }

    // this method does three things:
    // 1. applies the grain envelope, set in the EnvelopePicker component
    // 2. applies gain to each grain
    // 3. plays the grain
    generateAndPlayGrain() {
      // 1.
      // generate a grain,
      const grain = this.grainSource.makeGrain();
      // generate an envelope,
      const env = this.envelope.generate(grain);
      // and apply the envelope to the grain
      // by multiplying with each channel.
      for (let ch=0; ch<grain.numberOfChannels; ch++) {
        const chanBuff = grain.getChannelData(ch);
        grain.copyToChannel(Float32Array.from(numeric.mul(env,chanBuff)), ch);
      }

      // 2.
      // create the AudioBufferSourceNode from the grain AudioBuffer,
      const src = this.props.audioCtx.createBufferSource();
      src.buffer = grain;
      // apply a GainNode,
      const gainNode = this.props.audioCtx.createGain();
      gainNode.gain.value = this.state.gain;
      src.connect(gainNode);
      // get any additional connector AudioNodes from grainSource,
      // (pass in src for last-minute manipulations by grainSource)
      const connector = this.grainSource.getConnector(src);
      gainNode.connect(connector);

      // 3.
      // and play the grain!
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
      // play something...
      this.intervalId = window.setInterval(() => {
        this.callControlFunctions();
        this.generateAndPlayGrain();
      }, 1000/this.state.grainDensity);
      // and show something.
      const animationFunc = () => {
        this.animation = window.requestAnimationFrame(animationFunc);
        this.grainSource.drawViz();
      }
      animationFunc();
    }
    stopCloud() {
      // stop playing...
      window.clearInterval(this.intervalId);
      // and stop showing.
      this.animation = window.cancelAnimationFrame(this.animation);
      this.grainSource.resetViz();
    }
  }
}

export const WaveformGrainCloud = grainCloud(WaveformGrainSource);
export const SampleGrainCloud = grainCloud(SampleGrainSource);
