/* eslint-disable camelcase */
import { expect } from 'chai'
import geoTreeUtils, { _aggregateClusters, _sortAndLimitClusters } from '../geoTreeUtils'
import treeUtils from '../../treeUtils'
import newick from '../newick'
import { reduceLimitRest } from '../../statistics'
import _ from 'lodash'

describe('geoTreeUtils', () => {
    
    function setParents(node) {
        (node.children || []).forEach(child => {
            child.parent = node;
            setParents(child);
        });
    }
    
    let newick1, clustersPerSpecies, clustersPerSpeciesLimited, testTreeWithClusters;
    
    before(() => {
        newick1 = '((00,01)0,1,(20,21)2)root;';
        clustersPerSpecies = {
            '00': { totCount: 5, clusters: [
                {clusterId: 1, count: 3},
                {clusterId: 0, count: 2},
            ]},
            '01': { totCount: 2, clusters: [
                {clusterId: 1, count: 2},
            ]},
            '1': { totCount: 6, clusters: [
                {clusterId: 2, count: 4},
                {clusterId: 1, count: 2},
            ]},
            '20': { totCount: 12, clusters: [
                {clusterId: 2, count: 3},
                {clusterId: 3, count: 3},
                {clusterId: 0, count: 2},
                {clusterId: 1, count: 2},
                {clusterId: 4, count: 1},
                {clusterId: 5, count: 1},
            ]},
            '21': { totCount: 4, clusters: [
                {clusterId: 2, count: 2},
                {clusterId: 3, count: 2},
            ]},
        };
    
        testTreeWithClusters = {
            name: 'root',
            clusters: { totCount: 29, clusters: [
                { clusterId: 1, count: 9},
                { clusterId: 2, count: 9},
                { clusterId: 3, count: 5},
                { clusterId: 0, count: 4},
                { clusterId: 4, count: 1},
                { clusterId: 5, count: 1},
            ] },
            children: [
                {
                    name: '0',
                    clusters: { totCount: 7, clusters: [
                        { clusterId: 1, count: 5},
                        { clusterId: 0, count: 2},
                    ] },
                    children: [
                        {
                            name: '00',
                            clusters: { totCount: 5, clusters: [
                                { clusterId: 1, count: 3},
                                { clusterId: 0, count: 2},
                            ] },
                        },
                        {
                            name: '01',
                            clusters: { totCount: 2, clusters: [
                                { clusterId: 1, count: 2},
                            ] },
                        },
                    ]
                },
                {
                    name: '1',
                    clusters: { totCount: 6, clusters: [
                        { clusterId: 2, count: 4},
                        { clusterId: 1, count: 2},
                    ] },
                },
                {
                    name: '2',
                    clusters: { totCount: 16, clusters: [
                        { clusterId: 2, count: 5},
                        { clusterId: 3, count: 5},
                        { clusterId: 0, count: 2},
                        { clusterId: 1, count: 2},
                        { clusterId: 4, count: 1},
                        { clusterId: 5, count: 1},
                    ] },
                    children: [
                        {
                            name: '20',
                            clusters: { totCount: 12, clusters: [
                                { clusterId: 2, count: 3},
                                { clusterId: 3, count: 3},
                                { clusterId: 0, count: 2},
                                { clusterId: 1, count: 2},
                                { clusterId: 4, count: 1},
                                { clusterId: 5, count: 1},
                            ] },
                        },
                        {
                            name: '21',
                            clusters: { totCount: 4, clusters: [
                                { clusterId: 2, count: 2},
                                { clusterId: 3, count: 2},
                            ] },
                        },
                    ]
                },
            ]
        };
        
        setParents(testTreeWithClusters);
        
        clustersPerSpeciesLimited = _(clustersPerSpecies)
            .map((originalClusters, nodeName) => {
                const clusters = _.cloneDeep(originalClusters);
                const { totCount } = clusters;
                clusters.clusters = reduceLimitRest(
                    0,
                    (sum, {count}) => sum + count,
                    (sum, {count}) => count / totCount > 0.1 || sum / totCount < 0.1,
                    (sum, restItems) => { return { clusterId: 'rest', count: totCount - sum, rest: restItems }; },
                    clusters.clusters);
                return [nodeName, clusters];
            })
            .fromPairs()
            .value();
        expect(clustersPerSpeciesLimited).to.deep.equal({
            '00': { totCount: 5, clusters: [
                {clusterId: 1, count: 3},
                {clusterId: 0, count: 2},
            ]},
            '01': { totCount: 2, clusters: [
                {clusterId: 1, count: 2},
            ]},
            '1': { totCount: 6, clusters: [
                {clusterId: 2, count: 4},
                {clusterId: 1, count: 2},
            ]},
            '20': { totCount: 12, clusters: [
                {clusterId: 2, count: 3},
                {clusterId: 3, count: 3},
                {clusterId: 0, count: 2},
                {clusterId: 1, count: 2},
                {clusterId: 'rest', count: 2, rest: [
                    {clusterId: 4, count: 1},
                    {clusterId: 5, count: 1},
                ]},
            ]},
            '21': { totCount: 4, clusters: [
                {clusterId: 2, count: 2},
                {clusterId: 3, count: 2},
            ]},
        });        
    })

    describe('_aggregateClusters', () => {
        it('should aggregate clusters from leaf nodes to root', () => {
            const result = newick.parse(newick1)
                .then(tree => _aggregateClusters(tree, clustersPerSpecies))
                .then(tree => {
                    treeUtils.visitTreeDepthFirst(tree, node => {
                        node.clusters.clusters = _(Array.from(node.clusters.clusters))
                            .map(([clusterId, count]) => { return {clusterId, count} })
                            .sortBy(({clusterId}) => clusterId)
                            .reverse()
                            .sortBy(({count}) => count)
                            .reverse()
                            .value();
                    })
                   return tree;
                });
            return expect(result).to.eventually.deep.eq(testTreeWithClusters);
        })
        
        it('should aggregate clusters with rest limit', () => {
            const result = newick.parse(newick1)
                .then(tree => _aggregateClusters(tree, clustersPerSpeciesLimited))
                .then(tree => {
                    treeUtils.visitTreeDepthFirst(tree, node => {
                        node.clusters.clusters = _(Array.from(node.clusters.clusters))
                            .map(([clusterId, count]) => { return {clusterId, count} })
                            .sortBy(({clusterId}) => clusterId)
                            .reverse()
                            .sortBy(({count}) => count)
                            .reverse()
                            .value();
                    })
                   return tree; 
                });
            return expect(result).to.eventually.deep.eq(testTreeWithClusters);
        })
    })

    describe('_sortAndLimitClusters', () => {
        it('should sort and limit clusters with a rest element for fraction limit', () => {
            const clusterMap = new Map([[0,100], [1,11], [2,22], [3,33]]);
            const totCount = _.sumBy(Array.from(clusterMap), v => v[1]);
            const clusters = {count: totCount, clusters: clusterMap};
            const result = _sortAndLimitClusters(clusters, 0.8);
            return expect(result).to.deep.eq({
                totCount,
                clusters: [
                    { clusterId: 0, count: 100 },
                    { clusterId: 'rest', count: 66, rest: [
                        { clusterId: 3, count: 33 },
                        { clusterId: 2, count: 22 },
                        { clusterId: 1, count: 11 },
                    ]},
                ],
            });
        })
        
        it('should only have a rest element if low enough fraction', () => {
            const clusterMap = new Map([[0,100], [1,11], [2,22], [3,33]]);
            const totCount = _.sumBy(Array.from(clusterMap), v => v[1]);
            const clusters = {count: totCount, clusters: clusterMap};
            const result = _sortAndLimitClusters(clusters, 0.1);
            return expect(result).to.deep.eq({
                totCount,
                clusters: [
                    { clusterId: 'rest', count: 166, rest: [
                        { clusterId: 0, count: 100 },
                        { clusterId: 3, count: 33 },
                        { clusterId: 2, count: 22 },
                        { clusterId: 1, count: 11 },
                    ]},
                ],
            });
        })
        
        it('should have no rest element for fraction 1.0', () => {
            const clusterMap = new Map([[0,100], [1,11], [2,22], [3,33]]);
            const totCount = _.sumBy(Array.from(clusterMap), v => v[1]);
            const clusters = {count: totCount, clusters: clusterMap};
            const result = _sortAndLimitClusters(clusters, 1.0);
            return expect(result).to.deep.eq({
                totCount,
                clusters: [
                    { clusterId: 0, count: 100 },
                    { clusterId: 3, count: 33 },
                    { clusterId: 2, count: 22 },
                    { clusterId: 1, count: 11 },
                ],
            });
        })
    })
    
    describe('aggregateSortAndLimitClusters', () => {
        it('should aggregate clusters sorted and grouped on limit', () => {
            // // TODO: Should clone testTreeWithClusters first!
            // treeUtils.visitTreeDepthFirst(testTreeWithClusters, (node) => {
            //     const {clusters} = node.clusters;
            //     const clusterMap = new Map(_(clusters).toPairs().map(([id,count]) => [+id,count]).value());
            //     node.clusters.clusters = clusterMap;
            //     node.clusters = _sortAndLimitClusters(node.clusters, 0.9);
            // });
            // const result = newick.parse(newick1)
            //     .then(tree => geoTreeUtils.aggregateSortAndLimitClusters(tree, clustersPerSpecies, 0.9));
            // return expect(result).to.eventually.deep.eq(testTreeWithClusterMap);
        })
    })
})
