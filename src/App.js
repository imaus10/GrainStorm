import React, { Component } from 'react';
import 'rc-slider/assets/index.css';
import 'rc-tooltip/assets/bootstrap.css';
import './audioshim';
import { WaveformGrainCloud, SampleGrainCloud } from './GrainCloud';
import './App.css';

// TODO: share across css & js?
export const mainColor = '#16ba42';

// the main class of the app,
// which has a list of grain sources,
// help text that gets displayed in the left panel,
// and a button that turns on the automatic control functions.
class GrainStorm extends Component {
  constructor(props) {
    super(props);
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.grainCloudIdSeq = 0;
    const expl = (
      <div><p>Granular synthesis is an electronic music technique where tiny "grains" of sound, typically lasting less than 100 milliseconds, are generated many times per second to make music. When many of these sound particles overlap, it is called a cloud.</p>
      <p>Generate a grain cloud using one of the two sources above.</p></div>
    );
    this.state = { grainClouds: []
                 , helpText: expl
                 , showControllable: false
                 };
  }
  render() {
    const ctrlButton = this.state.showControllable ? 'hide' : 'show';
    const ctrlhalp = 'Move sliders automatically with control functions.';
    const samplehalp = 'Upload a sound file as grain source.';
    const wavehalp = 'Use a sound wave to generate grains.';
    const ctrlBtnViz = this.state.grainClouds.length > 0 ? 'visible' : 'hidden';
    return (
      <div id="grainStormDevice">
        <div className="woodPanel"></div>
        <div id="middle">
          <div id="header">
            <h1>GrainStorm: granular synthesis in the browser</h1>
          </div>
          <div id="controls">
            <div id="leftPanel">
              <div id="addGrainCloudBox">
                <div>
                  <button type="button"
                          onMouseEnter={() => this.changeHelpText(samplehalp)}
                          onClick={() => this.fileUpload.click()}>+ sound file</button>
                  <input type="file"
                         ref={inp => this.fileUpload = inp}
                         style={{display:'none'}}
                         onChange={() => this.addSample()}></input>
                  <button type="button"
                          onClick={() => this.addWaveform()}
                          onMouseEnter={() => this.changeHelpText(wavehalp)}>+ sound wave</button>
                </div>
              </div>
              <div id="metaPanel">
                <h3>HELP</h3>
                <div className="leftScreen">{this.state.helpText}</div>
                <span>
                  <h3>PARAMETER CTRL</h3>
                  {<button id="showCtrlBtn"
                           type="button"
                           onClick={() => this.changeShowControllable()}
                           onMouseEnter={() => this.changeHelpText(ctrlhalp)}
                           style={{visibility: ctrlBtnViz}}>{ctrlButton}</button>}
                </span>
                <div id="metaScreen" className="leftScreen"></div>
              </div>
            </div>
            <div id="grainCloudBox">
              {this.state.grainClouds.map(gc =>
                <gc.type key={gc.id}
                         audioCtx={this.audioCtx}
                         audioData={gc.audioData || null}
                         removeCloud={() => this.removeCloud(gc.id)}
                         changeHelpText={text => this.changeHelpText(text)}
                         showControllable={this.state.showControllable} />
              )}
            </div>
          </div>
          <div id="footer">
          </div>
        </div>
        <div className="woodPanel"></div>
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
          this.setState({ grainClouds: this.state.grainClouds.concat(gc) });
        },
        e => {
          // TODO: prettier, more informative
          alert("Error decoding audio data: \n" + e);
        });
      this.fileUpload.value = '';
    };
    reader.readAsArrayBuffer(this.fileUpload.files[0]);
  }
  addWaveform() {
    const gc = { id: this.grainCloudIdSeq
               , type: WaveformGrainCloud
               };
    this.grainCloudIdSeq += 1;
    this.setState({ grainClouds: [gc].concat(this.state.grainClouds) });
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
