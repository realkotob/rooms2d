import Blitter from './Blitter.js';

const GetAdvancedValue = Phaser.Utils.Objects.GetAdvancedValue;
const BuildGameObject = Phaser.GameObjects.BuildGameObject;

export default function (config, addToScene) {
    if (config === undefined) { config = {}; }
    if (addToScene !== undefined) {
        config.add = addToScene;
    }
    var key = GetAdvancedValue(config, 'key', null);
    var frame = GetAdvancedValue(config, 'frame', null);
    var gameObject = new Blitter(this.scene, 0, 0, key, frame);
    BuildGameObject(this.scene, gameObject, config);
    return gameObject;
};