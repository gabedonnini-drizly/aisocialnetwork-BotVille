import { InteriorScene } from './InteriorScene.js';
import { INTERIORS } from '../config.js';

export class OfficeScene extends InteriorScene {
  constructor() { super('OfficeScene', INTERIORS.OfficeScene, 'office'); }
}
