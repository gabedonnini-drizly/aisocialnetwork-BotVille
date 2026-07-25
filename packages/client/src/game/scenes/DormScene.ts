import { InteriorScene } from './InteriorScene.js';
import { INTERIORS } from '../config.js';

export class DormScene extends InteriorScene {
  constructor() { super('DormScene', INTERIORS.DormScene, 'dorm'); }
}
