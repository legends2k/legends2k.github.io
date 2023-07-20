"use strict";

export class Texture {

    constructor(gl, img) {
        this.tex = gl.createTexture();
        this.image = new Image();
        // https://stackoverflow.com/q/20279484/183120
        let self = this;
        this.image.onload = function() {
            self.handleLoadedTexture(gl);
        };
        if (img != null) {
            this.setImage(img);
        }
    }

    setImage(file) {
        this.image.src = file;
    }

    handleLoadedTexture(gl) {
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D,
                         gl.TEXTURE_WRAP_S,
                         gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,
                         gl.TEXTURE_WRAP_T,
                         gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,
                         gl.TEXTURE_MIN_FILTER,
                         gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,
                         gl.TEXTURE_MAG_FILTER,
                         gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D,
                      0,
                      gl.RGBA,
                      gl.RGBA,
                      gl.UNSIGNED_BYTE,
                      this.image);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}
