import React, {Component, PropTypes} from 'react';
import treeChart from './treeChart.js';
import chroma from 'chroma-js';
import treeUtils from '../../utils/treeUtils';
import TangleInput from '../lib/TangleInput';
import Div from '../helpers/Div';
import geoTreeUtils from '../../utils/phylogeny/geoTreeUtils';

import TreeStyles from './Tree.scss';

const BY_ORIGINAL_ORDER = 'by original order';
const BY_BRANCH_SIZE_DESC = 'by branch size (descending)';
const BY_BRANCH_SIZE_ASC = 'by branch size (ascending)';
const BY_OCCURRENCE_COUNT = 'by occurrence count';

class Tree extends Component {

  static propTypes = {
    // width: PropTypes.number.isRequired,
    // height: PropTypes.number.isRequired,
    // bins: PropTypes.array.isRequired,
    clusterColors: PropTypes.array.isRequired,
    clustersPerSpecies: PropTypes.object.isRequired,
    speciesCount: PropTypes.object.isRequired,
    phyloTree: PropTypes.object,
  }
   
  initialState = {
    leafCountLimit: 200,
    filter: "",
    sortOptions: [BY_ORIGINAL_ORDER, BY_BRANCH_SIZE_DESC, BY_BRANCH_SIZE_ASC, BY_OCCURRENCE_COUNT],
    currentSortOption: BY_ORIGINAL_ORDER,
    currentSpeciesCount: 0,
    currentOccurrenceCount: 0,
  }
  
  state = {
    ...this.initialState,
  }

  shouldComponentUpdate(nextProps, nextState) {
    const {clustersPerSpecies, clusterColors, phyloTree} = this.props;
    return clusterColors !== nextProps.clusterColors ||
      clustersPerSpecies !== nextProps.clustersPerSpecies ||
      phyloTree !== nextProps.phyloTree ||
      !_.isEqual(this.state, nextState);
  }

  componentDidMount() {
    this.updateTree();
  }

  componentDidUpdate() {
    this.updateTree();
  }

  componentWillUnmount() {
    treeChart.destroy(this.svg);
  }
  
  calculateCurrentAggregate(tree) {
    if (!tree)
      return;
    let currentSpeciesCount = 0;
    let currentOccurrenceCount = 0;
    let numLeafs = 0;
    treeUtils.visitTreeDepthFirst(tree, (node) => {
      if (node.isLeaf) {
        currentSpeciesCount += node.speciesCount;
        currentOccurrenceCount += node.occurrenceCount;
        ++numLeafs;
      }
    });
    this.setState({ currentSpeciesCount, currentOccurrenceCount });
  }
  
  updateTree(newState) {
    console.log('Update tree!');
    const state = Object.assign({}, this.state, newState);
    const data = this.getData(state);
    treeChart.render(this.svg, data);
    treeChart.render(this.minimap, Object.assign({}, data, {
      minimap: true,
    }));
    this.calculateCurrentAggregate(data.phyloTree);
  }
  
  getData(state) {
    const { clusterColors, phyloTree } = this.props;
    if (!phyloTree)
      return this.props;
    const comparator = {
      [BY_ORIGINAL_ORDER]: 'originalIndex',
      [BY_BRANCH_SIZE_ASC]: 'leafCount',
      [BY_BRANCH_SIZE_DESC]: '-leafCount',
      [BY_OCCURRENCE_COUNT]: '-occurrenceCount',
    }
    const comp = comparator[state.currentSortOption];
    
    return {
      clusterColors,
      phyloTree: treeUtils.limitLeafCount(phyloTree, state.leafCountLimit, comp),
    };
  }

  getSvg() {
    return this.svg;
  }

  getSvgString() {
    return this.svg.outerHTML;
  }
  
  onChangeLeafCountLimit = (leafCountLimit) => {
    this.updateTree({ leafCountLimit });
    this.setState({ leafCountLimit });
  }
  
  handleChangeSort = (event) => {
    event.preventDefault();
    const currentSortOption = event.target.value;
    this.updateTree({ currentSortOption });
    this.setState({ currentSortOption });
  }
  
  render() {
    console.log("Tree::render()");
    const { phyloTree } = this.props;
    if (!phyloTree)
      return null;
    
    const { leafCount, speciesCount, occurrenceCount } = phyloTree;
    const { currentSortOption, sortOptions, currentSpeciesCount, currentOccurrenceCount } = this.state;
    
    // {speciesCount ? `${occurrenceCount} records of ${speciesCount} species aggregated in the tree` : null}

    return (
      <div className="ui two column stackable grid">
        <div className="four wide column">
          <div className="ui segment">
            <h4 className="ui header">Tree</h4>
            <svg id="treeMinimap" ref={(el) => this.minimap = el}>
            </svg>
            <p>Show max  
              <TangleInput className="ui label"
                  value={this.state.leafCountLimit}
                  min={1}
                  max={leafCount}
                  logStep={1}
                  speed={0.2}
                  onChange={this.onChangeLeafCountLimit} />
            of {leafCount} species</p>
            <select className="ui fluid dropdown" value={currentSortOption} onChange={this.handleChangeSort}>
              {
                sortOptions.map((sort, i) => (
                  <option key={i} value={sort}>{sort}</option>
                ))
              }
            </select>
            <table className="ui small celled definition table">
                <thead>
                  <tr>
                    <th>Map\Tree</th>
                    <th>selection</th>
                    <th>whole</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>species</td>
                    <td>{currentSpeciesCount}</td>
                    <td>{speciesCount}</td>
                  </tr>
                  <tr>
                    <td>occurrences</td>
                    <td>{currentOccurrenceCount}</td>
                    <td>{occurrenceCount}</td>
                  </tr>
                </tbody>
              </table>
          </div>
        </div>
        <div className="twelve wide column">
          <div style={{position: 'relative', overflow: 'auto'}}>
            <svg id="phylogram" ref={(el) => this.svg = el}>
            </svg>
          </div>
        </div>
      </div>
    );
  }
}

export default Tree;
