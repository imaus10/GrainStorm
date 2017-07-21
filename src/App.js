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
  // React methods:
  constructor(props) {
    super(props);
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.grainCloudIdSeq = 0;
    this.state = { grainClouds: []
                 , helpText: GrainStorm.walkthruHelp[0]
                 , showControllable: false
                 , walkthru: 0
                 };
  }
  render() {
    // addGrainCloudBtns
    const addSampleCls = 'glow' +
                         (this.state.walkthru === 0 ? ' glimmer' : '');
    const addWaveStyle = { display: this.state.walkthru === -1
                                  ? 'block'
                                  : 'none' };

    // parameter control div
    const paramCtrlStyle = { display: this.state.walkthru === -1
                                    ? 'block'
                                    : 'none' };
    const ctrlButton = this.state.showControllable ? 'hide' : 'show';
    const ctrlhalp = 'Move sliders automatically with control functions.';
    const ctrlBtnStyle = { visibility: this.state.grainClouds.length > 0
                                     ? 'visible'
                                     : 'hidden' };
    const ctrlHeadColor = this.state.showControllable ? '#00e5ff' : 'white';

    return (
      <div id="grainStormDevice">
        <div className="woodPanel"></div>
        <div id="controls">
          <div id="leftPanel">
            <div id="labelPlate">
              <h1>GrainStorm</h1>
              <h2>[granular synthesis in the browser]</h2>
            </div>
            <div id="addGrainCloudBtns">
              <button type="button"
                      className={addSampleCls}
                      disabled={this.state.walkthru > 0}
                      onClick={() => this.fileUpload.click()}>+ sound file</button>
              <input type="file"
                     style={{display:'none'}}
                     ref={inp => this.fileUpload = inp}
                     onChange={() => this.addSample()}></input>
              <button type="button"
                      className="glow"
                      style={addWaveStyle}
                      onClick={() => this.addWaveform()}>+ sound wave</button>
            </div>
            <div id="metaPanel">
              <div id="helpSection">
                <h3>HELP</h3>
                <div className="screen">{this.state.helpText}</div>
              </div>
              <div style={paramCtrlStyle}>
                <div>
                  <h3 style={{color: ctrlHeadColor}}>PARAMETER CTRL</h3>
                  {<button id="showCtrlBtn"
                           type="button"
                           className="glow"
                           style={ctrlBtnStyle}
                           onMouseEnter={() => this.changeHelpText(ctrlhalp)}
                           onClick={() => this.changeShowControllable()}>{ctrlButton}</button>}
                </div>
                <div id="paramCtrlScreen" className="screen"></div>
              </div>
            </div>
          </div>
          <div id="grainCloudBox">
            {this.state.grainClouds.map(gc =>
              <gc.type key={gc.id}
                       audioCtx={this.audioCtx}
                       audioData={gc.audioData || null}
                       removeCloud={() => this.removeCloud(gc.id)}
                       changeHelpText={text => this.changeHelpText(text)}
                       showControllable={this.state.showControllable}
                       walkthru={this.state.walkthru}
                       bumpWalkthru={(txt) => this.bumpWalkthru(txt)}/>
            )}
          </div>
        </div>
        <div className="woodPanel"></div>
      </div>
    );
  }

  // methods that call setState:
  changeShowControllable() {
    this.setState({ showControllable: !this.state.showControllable });
  }
  changeHelpText(text) {
    this.setState({ helpText: text });
  }
  bumpWalkthru() {
    const halp = (
      <div>
        {GrainStorm.walkthruHelp[this.state.walkthru+1]}
        { this.state.walkthru+1 === 1
        ? ''
        : <button type="button"
                  onClick={() => this.bumpWalkthru()}>OK &gt;&gt;</button>}
      </div>
    );
    this.setState({ walkthru: this.state.walkthru+1
                  , helpText: halp
                  });
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
          if (this.state.walkthru === 0) {
            this.bumpWalkthru();
          }
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

  static walkthruHelp = [
  // 0
    <div>
      <p>Granular synthesis is an electronic music technique that creates tiny "grains" of sound.</p>
      <p>Though each individual sound particle is miniscule, when many grains overlap, they create a texture known as a cloud.</p>
      <p>Generate a grain cloud by clicking the glowing button above.</p>
    </div>
  // 1
  , <p>Start the cloud by pressing the play button.</p>
  // 2
  , <div>
      <p>The playback sounds stuttery because the red playhead is taking a 30 millisecond grain sample every 100 milliseconds - there are gaps between grains.</p>
      <p>Grain density is how close together grains are packed. That is, when you increase the density, more grains are created, and grains overlap more.</p>
      <p>Move the slider to see what this sounds like.</p>
    </div>
  // 3
  , <div>
      <p>Increasing grain duration also increases overlap, for a kind of chorus effect that multiplies the volume.</p>
      <p>Try a high density and a low duration and see what happens.</p>
    </div>
  // 4
  , <div>
      <p>Use the slider below the playhead viewer to make grains from a specific part of the sample.</p>
      <p>You can get interesting repetitive sounds by narrowing in on a small section of the sample.</p>
    </div>
  // 5
  , <div>
      <p>Change the speed of the playhead.</p>
      <p>Move the slider exactly to the middle and the playhead stops moving, and makes the same grain over and over.</p>
      <p>Move to the left of middle, and the playhead direction reverses. Each grain is still played forward, but the sample position is moving backward.</p>
      <p>The farther the slider is from the middle, the faster the playhead goes.</p>
    </div>
  // 6
  , <p>Try changing the pitch of the sample.</p>
  // 7
  , <div>
      <p>Each grain has an envelope that controls how quickly the sample reaches full volume (attack) and how quickly it fades out (decay).</p>
      <p>Without the envelope, sounds would be very clicky. Verify this by sliding the left knob all the way left and the right knob all the way right.</p>
    </div>
  // 8
  , <div>
      <p>Now try different envelopes and see how the sound changes.</p>
    </div>
  ];
}

export default GrainStorm;
