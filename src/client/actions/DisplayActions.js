import {
  CHANGE_STATISTICS_BY,
  CHANGE_MAP_BY,
  SET_CLUSTER_COLORS,
} from '../constants/ActionTypes';

export function changeStatisticsBy(statisticsBy) {
  return {
    type: CHANGE_STATISTICS_BY,
    statisticsBy
  }
}

export function changeMapBy(mapBy) {
  return {
    type: CHANGE_MAP_BY,
    mapBy
  }
}

export function setClusterColors(clusterColors) {
  return {
    type: SET_CLUSTER_COLORS,
    clusterColors
  }
}
