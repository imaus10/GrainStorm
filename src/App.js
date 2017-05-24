import React, { Component } from 'react';
import numeric from 'numeric';
import Slider, { Range } from 'rc-slider';
import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import './audioshim';
import EnvelopePicker from './envelopes';
import { WaveformGrainSource, SampleGrainSource } from './grainsources';
import './App.css';

// TODO: share across css & js?
export const mainColor = '#16ba42';

export class ParameterBox extends Component {
  static paramIdSeq = 0
  constructor(props) {
    super(props);
    this.paramId = ParameterBox.paramIdSeq;
    ParameterBox.paramIdSeq += 1;
    this.state = { controlled: false, controlMin: props.min, controlMax: props.max };
  }
  componentDidUpdate(prevProps, prevState) {
    if (this.state.controlled !== prevState.controlled) {
      if (this.state.controlled) {
        this.props.addControlFunction(this.paramId, () => this.LFOControl());
      } else {
        this.props.removeControlFunction(this.paramId);
      }
    }

    if (this.state.controlMin !== prevState.controlMin ||
        this.state.controlMax !== prevState.controlMax)
    {
      this.props.addControlFunction(this.paramId, () => this.LFOControl());
    }
  }
  render() {
    return (
      <div className="parameterBox" onMouseEnter={() => this.props.changeHelpText(this.props.helpText)}>
        <label>{this.props.label}</label>
        <input type="number" value={this.props.value} readOnly></input>
        <Slider value={this.props.value}
                min={this.props.min}
                max={this.props.max}
                onChange={this.props.showControllable || this.state.controlled ? ()=>{} : this.props.onChange}
                onBeforeChange={this.props.showControllable ? () => this.changeControlled() : ()=>{}}
                className={this.props.showControllable || this.state.controlled ? 'controllable' : ''}/>
        { this.props.showControllable && this.state.controlled
        ? <Range defaultValue={[this.state.controlMin,this.state.controlMax]}
                 min={this.props.min}
                 max={this.props.max}
                 className='controlled'
                 onChange={(vals) => this.changeControls(vals)} />
        : ''
        }
      </div>
    );
  }
  changeControlled() {
    this.setState({ controlled: !this.state.controlled });
  }
  changeControls(vals) {
    this.setState({ controlMin: vals[0], controlMax: vals[1] });
  }
  randomControl() {
    const randInt = Math.floor(Math.random() * (this.state.controlMax-this.state.controlMin+1)) + this.state.controlMin;
    this.props.onChange(randInt);
  }
  LFOControl() {
    const f = 1;
    const A = (this.state.controlMax - this.state.controlMin)/2;
    const nextVal = A*Math.sin(2*Math.PI*f*Date.now()/1000) + this.state.controlMin + A;
    this.props.onChange(nextVal);
  }
}

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
      const playButtonTxt = this.state.playing ? 'stop' : 'play';
      const moreProps = { addControlFunction: (id,fn) => this.addControlFunction(id,fn)
                        , removeControlFunction: id => this.removeControlFunction(id)
                        };
      const props = Object.assign({}, moreProps, this.props);
      return (
        <div className="grainCloud">
          <div>
            <button type="button" onClick={() => this.changePlaying()}>{playButtonTxt}</button>
            <button className="removeCloud" type="button" onClick={this.props.removeCloud}>[x]</button>
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
            onChange={d => this.changeGrainDensity(d)}
            helpText={'The number of times per second a grain gets created. Smaller densities are perceived as rhythmic because of the silence between grains. At higher densities, grains overlap, and the perception of rhythm is replaced with a steady pulse.'}
            {...props} />
          <ParameterBox
            label="Grain duration"
            value={this.state.grainDuration*1000}
            min={1}
            max={100}
            helpText={'How long each grain lasts, in milliseconds.'}
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

const WaveformGrainCloud = grainCloud(WaveformGrainSource);
const SampleGrainCloud = grainCloud(SampleGrainSource);

class GrainStorm extends Component {
  constructor(props) {
    super(props);
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.grainCloudIdSeq = 0;
    const expl = (
      <div><p>Granular synthesis is an electronic music technique where tiny "grains" of sound, typically lasting less than 100 milliseconds, are generated many times per second to make music.</p>
      <p>The grains can come from slicing up a sound file, or by generating a tiny snippet of a sound wave.</p></div>
    );
    this.state = { grainClouds: [], helpText: expl, showControllable: false, controlBox: '' };
  }
  render() {
    const ctrl = (this.state.showControllable ? 'Hide' : 'Show') + ' controllable parameters';
    return (
      <div id="grainStormDevice">
        <div id="header">
          <h1>GrainStorm: granular synthesis in the browser</h1>
        </div>
        <div id="controls">
          <div id="leftPanel">
            <div id="addGrainCloudBox">
              <div>
                <div className="chooseGrainSource">
                  <input type="file" id="fileUpload" onChange={() => this.addSample()}></input>
                </div>
                <div>OR</div>
                <div className="chooseGrainSource">
                  <button type="button" onClick={() => this.addWaveform()}>Generate waveform</button>
                </div>
              </div>
            </div>
            <div id="metaScreen">
              <div>
                {this.state.helpText}
              </div>
              <hr/>
              <div>
                {this.state.grainClouds.length > 0 ? <button type="button" onClick={() => this.changeShowControllable()}>{ctrl}</button> : ''}
                {this.state.controlBox}
              </div>
            </div>
          </div>
          <div id="grainCloudBox">
            {this.state.grainClouds.map(gc =>
              <gc.type key={gc.id}
                       audioCtx={this.audioCtx}
                       audioData={gc.audioData || null}
                       removeCloud={() => this.removeCloud(gc.id)}
                       changeHelpText={(text) => this.changeHelpText(text)}
                       showControllable={this.state.showControllable} />
            )}
          </div>
        </div>
        <div id="footer">
        </div>
      </div>
    );
  }
  changeShowControllable() {
    const expl = this.state.showControllable ? this.state.helpText : <p>Click on any blue slider to choose automatic control functions for that parameter.</p>;
    this.setState({ showControllable: !this.state.showControllable, helpText: expl });
  }
  changeHelpText(text) {
    this.setState({ helpText: <p>{text}</p> });
  }
  addSample() {
    const fileUpload = document.getElementById('fileUpload');
    const reader = new FileReader();
    reader.onerror = e => {
      // TODO: prettier, more informative
      alert("Error reading file: \n" + e);
    }
    reader.onload = () => {
      // console.log('decoding...');
      this.audioCtx.decodeAudioData(reader.result,
        decodedAudioData => {
          // console.log('decoded.');
          const gc = { id: this.grainCloudIdSeq
                     , audioData: decodedAudioData
                     , type: SampleGrainCloud
                     };
          this.grainCloudIdSeq += 1;
          this.setState({ grainClouds: this.state.grainClouds.concat(gc)
                        , helpText: <p>Hover over labels for explanations.</p>
                        });
        },
        e => {
          // TODO: prettier, more informative
          alert("Error decoding audio data: \n" + e);
        });
      fileUpload.value = '';
    };
    reader.readAsArrayBuffer(fileUpload.files[0]);
  }
  addWaveform() {
    const gc = { id: this.grainCloudIdSeq
               , type: WaveformGrainCloud
               };
    this.grainCloudIdSeq += 1;
    this.setState({ grainClouds: [gc].concat(this.state.grainClouds)
                  , helpText: <p>Hover over labels for explanations.</p>
                  });
  }
  removeCloud(id) {
    const idx = this.state.grainClouds.findIndex(el => {return el.id === id});
    const c1 = this.state.grainClouds.slice(0, idx);
    const c2 = this.state.grainClouds.slice(idx+1);
    const clouds = c1.concat(c2);
    this.setState({ grainClouds: clouds });
  }
}

export default GrainStorm;
