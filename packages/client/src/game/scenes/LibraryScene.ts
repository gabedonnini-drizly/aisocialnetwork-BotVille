import { InteriorScene } from './InteriorScene.js';
import { INTERIORS } from '../config.js';

export class LibraryScene extends InteriorScene {
  constructor() { super('LibraryScene', INTERIORS.LibraryScene, 'library'); }
}
