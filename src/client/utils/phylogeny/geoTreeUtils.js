import treeUtils from '../treeUtils';
import _ from 'lodash';
import { reduceLimitRest, forEachLimited, unrollRest } from '../statistics';


/**
 * Internal function to simply aggregate clusters and count from leafs to root
 * into cluster maps on each node
 * @param clustersPerSpecies: {}, // name -> {totCount, clusters: limitRest([{clusterId, count}, ...])}
 * Each node in the tree will get .clusters: { totCount:Number, clusters: Map[[clusterId,count]] }
 * @return the modified tree
 */
export function _aggregateClusters(tree, clustersPerSpecies = {}) {
    // Ensure parents set
    if (tree.children && !tree.children[0].parent) {
        treeUtils.setParents(tree);
    }
    
    treeUtils.visitTreeDepthFirst(tree, (node) => {
        // Use Map instead of Object to keep clusterIds as numbers
        node.clusters = { totCount: 0, clusters: new Map() };
        if (node.children)
            return;
            
        const aggregateCount = (clusterAggregateMap, clusterId, count) => {
            const aggregatedCount = clusterAggregateMap.get(clusterId);
            if (aggregatedCount === undefined)
                clusterAggregateMap.set(clusterId, count);
            else
                clusterAggregateMap.set(clusterId, aggregatedCount + count);
        }
        
        const clusters = clustersPerSpecies[node.name];
        if (clusters) {
            treeUtils.visitAncestors({ includeStartNode: true }, node, ancestor => {
                ancestor.clusters.totCount += clusters.totCount;
                const ancestorClusters = ancestor.clusters.clusters;
                clusters.clusters.forEach(({clusterId, count, rest}) => {
                    if (rest && rest.length) {
                        rest.forEach(({clusterId, count}) => {
                            aggregateCount(ancestorClusters, clusterId, count);
                        });
                    }
                    else {
                        aggregateCount(ancestorClusters, clusterId, count);
                    }                    
                })
            })
        }
    });
    return tree;
}

/**
 * Internal function to transform cluster map to sorted array grouped on fraction limit
 * @param clusters {totCount, clusters: Map([[clusterId,count],...])
 * @param totCount sum count in clusterMap
 * @param fractionThreshold limit clusters if count less than fractionThreshold
 * @return object {totCount, [{clusterId, count}, ..., [{clusterId: 'rest', count, rest: [{clusterId, count}, ...]}]}
 */
export function _sortAndLimitClusters({totCount, clusters}, fractionThreshold = 0.1) {
    const sortedClusters = _(Array.from(clusters))
        .map(([clusterId, count]) => {
            return {clusterId, count};
        })
        // Sort on descending count and then increasing clusterId (from Map)
        .reverse()
        .sortBy('count') // stable sort, keeps order for equal items
        .reverse()
        .value();
    
    const limitedClusters = reduceLimitRest(0,
        (sum, {count}) => sum + count,
        (sum, {count}) => count / totCount >= fractionThreshold || sum / totCount < fractionThreshold,
        (sum, rest) => { return { clusterId: 'rest', count: totCount - sum, rest}; },
        sortedClusters);
    
    return {
        totCount,
        clusters: limitedClusters,
    }
}

/**
 * Handle output from BayArea
 * @param area_pp {Array} array of probabilities for each bioregion
 * @return clusters {Object}, same as in aggregateClusters
 */
export function _denseAreaProbsToSparseClusters(area_pp, fractionThreshold = 0.1) {
    if (!area_pp) {
        return {
            totCount: 0,
            clusters: []
        }
    }
    // area_pp = [p1, p2, p3, ..., pm] for m bioregions
    const totCount = _.sum(area_pp);
    let clu = _(area_pp)
        .map((p, i) => { return { clusterId: i, count: p } })
        .filter(d => d.count > 0.01)
        .reverse()
        .sortBy('count')
        .reverse()
        .value();
        
        
    const limitedClusters = reduceLimitRest(0,
        (sum, {count}) => sum + count,
        (sum, {count}) => count / totCount >= fractionThreshold || sum / totCount < fractionThreshold,
        (sum, rest) => { return { clusterId: 'rest', count: totCount - sum, rest}; },
        clu);
    
    return {
        totCount,
        clusters: limitedClusters,
    }
}

export function calcMaximumParsimonyPreliminaryPhase(tree, clustersPerSpecies) {
    treeUtils.visitTreeDepthFirst({postOrder: true}, tree, (node) => {
        if (!node.children) {
            const clusters = clustersPerSpecies[node.name];
            if (clusters) {
                const presenceCountedClusters = unrollRest(clusters.clusters)
                    .map(({clusterId}) => { return { clusterId, count: 1}; });
                node.clusters = {
                    totCount: presenceCountedClusters.length,
                    clusters: presenceCountedClusters,
                };
            } else {
                node.clusters = {
                    totCount: 0,
                    clusters: [],
                }
            }
        } else {
            // Ancestor nodes
            const childClusters = _.map(node.children, child => child.clusters.clusters);
            // First try with intersection
            let ancestorClusters = _.intersectionBy(...childClusters, 'clusterId');
            // If empty, use union
            const byUnion = ancestorClusters.length === 0; 
            if (byUnion) {
                ancestorClusters = _.unionBy(...childClusters, 'clusterId');
            }
            node.clusters = {
                clusters: ancestorClusters,
                byUnion,
            }
        }
    });
    return tree;    
}

/**
 * 
I. If the preliminary nodal set contains all of the nucleotides present in the final nodal set of its immediate an- cestor, go to II, otherwise go to III.
II. Eliminate all nucleotides from the preliminary nodal set that are not present in the final nodal set of its immediate ancestor and go to VI.
III. If the preliminary nodal set was formed by a union of its descendent sets, go to IV, otherwise go to V.
IV. Add to the preliminary nodal set any nucleotides in the final set of its im- mediate ancestor that are not present in the preliminary nodal set and go to VI.
V. Add to the preliminary nodal set any nucleotides not already present pro- vided that they are present in both the final set of the immediate ancestor and in at least one of the two immedi- ately descendent preliminary sets and go to VI.
VI. The preliminary nodal set being ex- amined is now final. Descend one node as long as any preliminary nodal sets remain and return to I above.
 */
export function calcMaximumParsimonyFinalPhase(tree) {
    treeUtils.visitTreeDepthFirst(tree, (node, depth, childIndex, parent) => {
        // Preliminary set for root node is already the final set, and leaf nodes too?!
        if (!parent || !node.children) {
            return;
        }
        const intersection = _.intersectionBy(node.clusters.clusters, parent.clusters.clusters, 'clusterId');
        // Check if child contains all parent's nodes
        if (intersection.length === parent.clusters.clusters.length) {
            // II -> Rule of diminished ambiguity
            // console.log(`@@ Rule II`)
            node.clusters = {
                clusters: intersection,
            };
        } else {
            // III
            // console.log(`@@ Rule III`)
            if (node.byUnion) {
                // IV -> Rule of expanded ambiguity
                // console.log(`@@ Rule IV`)
                node.clusters = {
                    clusters: _.unionBy(node.clusters.clusters, parent.clusters.clusters, 'clusterId'),
                }
            } else {
                // V -> Rule of encompassing ambiguity
                // console.log(`@@ Rule V`)
                const diff = _.differenceBy(intersection, parent.clusters.clusters, 'clusterId');
                const childIntersections = _.map(node.children, child => _.intersectionBy(diff, child.clusters.clusters, 'clusterId'));
                const atLeastOneInChild = _.unionBy(...childIntersections, 'clusterId');
                node.clusters = {
                    clusters: node.clusters.clusters.concat(atLeastOneInChild),
                }
            }
        }
    });
}

export function calcMaximumParsimony(tree, clustersPerSpecies = {}, fractionThreshold = 0.1) {
    calcMaximumParsimonyPreliminaryPhase(tree, clustersPerSpecies);
    calcMaximumParsimonyFinalPhase(tree);
    return tree;
}

/**
 * Aggregate clusters on the tree, sorted and limited by fractionThreshold.
 * @param tree:Object the tree
 * * @param clustersPerSpecies: {}, // name -> {totCount, clusters: limitRest([{clusterId, count}, ...])}
 * @param fractionThreshold limit clusters if count less than fractionThreshold
 * 
 * Each node in the tree will get .clusters: { totCount:Number, clusters: limitRest([{clusterId,count}, ...]) }
 * @note it will expand all nodes before aggregating clusters
 * @return the modified tree
 */
export function aggregateClusters(tree, clustersPerSpecies = {}, fractionThreshold = 0.1) {
    treeUtils.expandAll(tree);
    _aggregateClusters(tree, clustersPerSpecies);
    treeUtils.visitTreeDepthFirst(tree, (node) => {
        node.clusters = _sortAndLimitClusters(node.clusters, fractionThreshold);
    });
    return tree;
}

export function reconstructAncestralAreas(tree, clustersPerSpecies = {}, fractionThreshold = 0.1) {
    treeUtils.expandAll(tree);
    // Check if areas already annotated (from BayArea)
    if (tree.area_pp) {
        treeUtils.visitTreeDepthFirst(tree, (node) => {
            node.clusters = _denseAreaProbsToSparseClusters(node.area_pp, fractionThreshold);
            // Delete redundant source
            delete node.area_pp;
        });
    }
    else {
        calcMaximumParsimony(tree, clustersPerSpecies, fractionThreshold);
    }
    
    return tree;
}

export function resetClusters(tree) {
    treeUtils.visitTreeDepthFirst(tree, (node) => {
        node.clusters = { totCount: 0, clusters: [] }
    });
    return tree;
}

/**
 * Aggregate speciesCount and occurrenceCount on each node
 * @param tree {Object} the tree
 * @param speciesCount {Object} map {name -> count} for each species
 * 
 * @note it will expand all nodes
 */
export function aggregateSpeciesCount(tree, speciesCount) {
    treeUtils.expandAll(tree);
    treeUtils.visitTreeDepthFirst({ postOrder: true }, tree, node => {
        if (!node.children) {
            const count = speciesCount[node.name];
            node.speciesCount = count ? 1 : 0;
            node.occurrenceCount = count || 0;
        }
        else {
            let sumSpeciesCount = 0;
            let sumOccurrenceCount = 0;
            _.forEach(node.children, (child) => {
                sumSpeciesCount += child.speciesCount;
                sumOccurrenceCount += child.occurrenceCount;
            });
            node.speciesCount = sumSpeciesCount;
            node.occurrenceCount = sumOccurrenceCount;
        }
    });
    return tree;
}

export default {
    aggregateClusters,
    reconstructAncestralAreas,
    resetClusters,
    aggregateSpeciesCount,
}