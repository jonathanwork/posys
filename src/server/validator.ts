
import * as _ from 'lodash';

export default {
  isRequired: (x) => !!x,
  isInt:      (x, { min, max } = { min: undefined, max: undefined }) => {
    const test = +x;
    if(_.isNaN(+test))     { return false; }
    if(min && test < min)  { return false; }
    if(max && test > max)  { return false; }
    return true;
  },
  isLength:   (x, { min, max } = { min: undefined, max: undefined }) => {
    const test = '' + x;
    if(!test)                    { return false; }
    if(min && test.length < min) { return false; }
    if(max && test.length > max) { return false; }
    return true;
  },
  isFloat:    (x, { min, max } = { min: undefined, max: undefined }) => {
    const test = +x;
    if(_.isNaN(+test))              { return false; }
    if(min && test < min)           { return false; }
    if(max && test > max)           { return false; }
    if(!_.includes('' + test, '.')) { return false; }
    return true;
  }
};