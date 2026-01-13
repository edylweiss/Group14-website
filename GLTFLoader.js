/**
 * @author mrdoob / http://mrdoob.com/
 * @author Tony Parisi / https://www.tonyparisi.com/
 */

THREE.GLTFLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

	this.path = '';
	this.resourcePath = '';
	this.crossOrigin = 'anonymous';

};

THREE.GLTFLoader.prototype = {

	constructor: THREE.GLTFLoader,

	load: function ( url, onLoad, onProgress, onError ) {

		var scope = this;

		var path = this.path === '' ? THREE.LoaderUtils.extractUrlBase( url ) : this.path;

		var loader = new THREE.FileLoader( this.manager );

		loader.setPath( this.path );
		loader.setResponseType( 'arraybuffer' );

		loader.load( url, function ( data ) {

			try {

				scope.parse( data, path, onLoad, onError );

			} catch ( e ) {

				if ( onError ) {

					onError( e );

				} else {

					throw e;

				}

			}

		}, onProgress, onError );

	},

	setPath: function ( path ) {

		this.path = path;
		return this;

	},

	setResourcePath: function ( resourcePath ) {

		this.resourcePath = resourcePath;
		return this;

	},

	setCrossOrigin: function ( value ) {

		this.crossOrigin = value;
		return this;

	},

	parse: function ( data, path, onLoad, onError ) {

		// Minimal fake parser just to avoid import/export issues
		// The real GLTFLoader logic is bundled in newer versions of three.js,
		// but MindAR’s example uses this global-style version for backward compatibility.

		if ( onLoad ) {
			console.warn('⚠️ This simplified GLTFLoader placeholder is loaded. Use a proper GLTFLoader from three/examples/js/loaders/ if available.');
			onLoad({ scene: new THREE.Group() });
		}
	}

};
