import React, { Component } from 'react';
import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import './audioshim';
import { WaveformGrainCloud, SampleGrainCloud } from './graincloud';
import './App.css';

// TODO: share across css & js?
export const mainColor = '#16ba42';

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
