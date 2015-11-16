import * as ActionTypes from '../constants/ActionTypes';

const initialState = {
  isLoading: false,
  files: [], // array of File objects to load
  sampleFiles: [
    {
      name: "Snakes in South Africa",
      filename: 'data/coordinates_snakes_south_america.txt'
    },
  ],
  error: false,
  message: "",
  subMessage: "",
  headLines: [],
  parsedHead: [], // To select name,lat,long fields in dsv file
  parsedFeatureProperty: null, // To select name field in shapefiles/GeoJSON
};

export default function files(state = initialState, action) {
  switch (action.type) {
    case ActionTypes.LOAD_FILES:
      return {
        ...state,
        files: action.files,
        isLoading: true
      };
    case ActionTypes.FILE_ERROR:
      return {
        ...state,
        error: true,
        message: action.message,
        subMessage: action.subMessage
      };
    case ActionTypes.REQUEST_DSV_COLUMN_MAPPING:
      return {
        ...state,
        parsedHead: action.parsedHead
      };
    case ActionTypes.REQUEST_GEOJSON_NAME_FIELD:
      return {
        ...state,
        parsedFeatureProperty: action.parsedFeatureProperty
      };
    case ActionTypes.CANCEL_FILE_ACTIONS:
      return initialState;
    case ActionTypes.ADD_SPECIES_AND_BINS:
      return {
        ...state,
        isLoading: false,
      };
    default:
      return state;
  }
}
