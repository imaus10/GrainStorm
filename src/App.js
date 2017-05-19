import React, { Component } from 'react';
import numeric from 'numeric';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import Tooltip from 'rc-tooltip';
import 'rc-tooltip/assets/bootstrap.css';
import './audioshim';
import EnvelopePicker from './envelopes';
import { WaveformGrainSource, SampleGrainSource } from './grainsources';
import './App.css';

// TODO: share across css & js?
export const mainColor = '#16ba42';

export function ParameterBox(props) {
  const content = (
    <div className="parameterBox">
      <label>{props.label}</label>
      <input type="number" value={props.value} readOnly></input>
      <Slider
        value={props.value}
        min={props.min}
        max={props.max}
        onChange={props.onChange} />
    </div>
  );
  if (props.help) {
    const hover = <p className="helpBox">{props.helpText}</p>;
    return (
      <Tooltip placement="right" overlay={hover}>
        {content}
      </Tooltip>
    );
  } else {
    return content;
  }
}

function grainCloud(GrainSource) {
  return class GrainCloud extends Component {
    constructor(props) {
      super(props);
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
      return (
        <div className="grainCloud">
          <div>
            <button type="button" onClick={() => this.changePlaying()}>{playButtonTxt}</button>
            <button className="removeCloud" type="button" onClick={this.props.removeCloud}>[x]</button>
          </div>
          <GrainSource
            ref={gs => this.grainSource = gs}
            {...this.state}
            {...this.props} />
          <ParameterBox
            label={"Grain density"} // unicode hex 2374
            value={this.state.grainDensity}
            min={1}
            max={100}
            help={this.props.help}
            helpText={'The number of times per second a grain gets created. Smaller densities are perceived as rhythmic because of the silence between grains. At higher densities, grains overlap, and the perception of rhythm is replaced with a steady pulse.'}
            onChange={d => this.changeGrainDensity(d)} />
          <ParameterBox
            label="Grain duration"
            value={this.state.grainDuration*1000}
            min={1}
            max={100}
            help={this.props.help}
            helpText={'How long each grain lasts, in milliseconds.'}
            onChange={dur => this.changeGrainDuration(dur)} />
          <EnvelopePicker
            ref={env => this.envelope = env}
            {...this.state}
            {...this.props} />
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
    this.state = { grainClouds: [], walkthru: 0, help: true };
  }
  render() {
    let ctrlPanel;
    if (this.state.walkthru === 0) {
      ctrlPanel = (
        <div className="ctrlPanel">
          <p>Granular synthesis is an electronic music technique where tiny "grains" of sound, typically lasting less than 100 milliseconds, are generated many times per second to make music.</p>
          <p>The grains can come from slicing up a sound file, or by generating a tiny snippet of a waveform, for example a sine wave.</p>
        </div>
      );
    } else {
      const halp = this.state.help ? 'Turn off help' : 'Turn on help';
      ctrlPanel = (
        <div className="ctrlPanel">
          <p>Hover over labels for explanations.</p>
          <button type="button" onClick={() => this.changeHelp()}>{halp}</button>
        </div>
      );
    }
    return (
      <div>
        <h1>GrainStorm: granular synthesis in the browser</h1>
        <div id="bigBox">
          <div className="ctrlPanel">
            {ctrlPanel}
          </div>
          {this.state.grainClouds.map(gc =>
            <gc.type key={gc.id}
                     audioCtx={this.audioCtx}
                     audioData={gc.audioData || null}
                     removeCloud={() => this.removeCloud(gc.id)}
                     help={this.state.help} />
          )}
          <div className="addGrainCloudBox">
            <div className="chooseGrainSource">
              <input type="file" id="fileUpload" onChange={() => this.addSample()}></input>
            </div>
            <div>OR</div>
            <div className="chooseGrainSource">
              <button type="button" onClick={() => this.addWaveform()}>Generate waveform</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  changeHelp() {
    this.setState({ help: !this.state.help });
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
          const walkthru = this.state.walkthru === 0 ? 1 : this.state.walkthru;
          this.setState({ grainClouds: this.state.grainClouds.concat(gc)
                        , walkthru: walkthru
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
    const walkthru = this.state.walkthru === 0 ? 1 : this.state.walkthru;
    this.setState({ grainClouds: this.state.grainClouds.concat(gc)
                  , walkthru: walkthru
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
