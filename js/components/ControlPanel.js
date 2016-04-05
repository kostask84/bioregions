import React, {Component, PropTypes} from 'react';
import FileLoader from './FileLoader';
import Binning from './Binning';
import Export from './Export';
import {BY_NAME, BY_CLUSTER} from '../constants/Display';
import InlineForm from './InlineForm';
import TangleInput from './TangleInput';
import Checkbox from './Checkbox';
import Tooltip from './Tooltip';
import Colors from './Colors';
import ShowInfomapButton from './Infomap/ShowInfomapButton';
import InfomapDimmer from './Infomap/InfomapDimmer';

class ControlPanel extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    $('.ui.accordion').accordion();
  }

  render() {
    const {files, data, worldmap, actions} = this.props;
    return (
      <div>
        <div className="ui styled accordion">
          <div className="active title">
            <i className="dropdown icon"></i>
            Data
          </div>
          <div className="active content">
            <FileLoader {...data} {...files} {...actions} />
            <Binning {...data.binning} binningLoading={data.binningLoading} progressEmitter={data.progressEmitter} {...actions} />
            <ShowInfomapButton {...data} {...actions} />
          </div>
          <div className="title">
            <i className="dropdown icon"></i>
            Display
          </div>
          <div className="content">
            <h4 className="ui dividing header">
              Map
              <span className="">
                <Tooltip>
                  <i className="help icon" style={{color: '#ccc'}}></i>
                  <div className="ui floating segment">
                    <table className="ui very basic celled table" style={{
                        backgroundColor: "white",
                        width: "400px",
                        fontWeight: 300,
                      }}>
                      <tbody>
                        <tr>
                          <td><strong>Grid resolution</strong></td>
                          <td>The resolution of the grid overlay.</td>
                        </tr>
                        <tr>
                          <td><strong>Show grid</strong></td>
                          <td>Toggle the visibility of the grid.</td>
                        </tr>
                        <tr>
                          <td><strong>Clip to land</strong></td>
                          <td>Clip the occupied grid cells to the land borders.</td>
                        </tr>
                        <tr>
                          <td><strong>Show cell borders</strong></td>
                          <td>Show borders on occupied grid cells.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Tooltip>
              </span>
            </h4>
            <InlineForm label="Grid resolution">
              <TangleInput className="ui label" suffix="˚"
                value={worldmap.graticuleStep}
                min={1}
                max={180}
                step={1}
                onChange={(value) => actions.changeGraticuleStep(value)} />
            </InlineForm>
            <p></p>
            <Checkbox label="Show grid" checked={worldmap.showGraticules} onChange={actions.changeShowGraticules}></Checkbox>
            <Checkbox label="Clip to land" checked={worldmap.clipToLand} onChange={actions.changeClipToLand}></Checkbox>
            <Checkbox label="Show cell borders" checked={worldmap.showCellBorders} onChange={actions.changeShowCellBorders}></Checkbox>

            <Colors {...data} {...worldmap} {...actions}></Colors>
            <h4 className="ui dividing header">Export</h4>
            <Export {...data} {...files} {...worldmap}></Export>
          </div>
        </div>
        <InfomapDimmer {...data} {...actions} />
      </div>
    );
  }
}

ControlPanel.propTypes = {
  files: PropTypes.object.isRequired,
  data: PropTypes.object.isRequired,
  worldmap: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
};

export default ControlPanel;
