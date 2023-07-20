"use strict";

export function compileShader(gl, id) {
    var element = document.getElementById(id);
    if (!element)
        return null;
    var code = "";
    var k = element.firstChild;
    while (k) {
        if (k.nodeType == Node.TEXT_NODE) {
            code += k.textContent;
        }
        k = k.nextSibling;
    }
    var shader;
    if (element.type == "x-shader/x-vertex")
        shader = gl.createShader(gl.VERTEX_SHADER);
    else if (element.type == "x-shader/x-fragment")
        shader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(id + " shader failed to compile!\n" + gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

export function link(gl, shaders) {
    var program = gl.createProgram();
    gl.attachShader(program, shaders[0]);
    gl.attachShader(program, shaders[1]);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert(gl.getProgramInfoLog(program));
        return null;
    }
    gl.validateProgram(program);
    if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
        alert(gl.getProgramInfoLog(program));
        return null;
    }
    gl.detachShader(program, shaders[1]);
    gl.detachShader(program, shaders[0]);
    return program;
}

export function loadAttribLocs(gl, prog, attribs) {
    // Different programs have different indices for the same
    // attributes. Similarly, mesh attribute data will be strewn across
    // different buffers with different memory layout. The property that
    // maps these two at render time is the attribute type. Every attribute
    // location would first be enabled and based on its attribute type, its
    // respective buffer is bound. Say the lighting program would not have
    // any attribute of type Tangent while the normal mapping program would
    // and but these programs' attributes are catered to by the object's
    // mesh data.

    // the index is the attribute location and element value is the
    // attribute type
    var attribTypes = [];
    for (var a in attribs) {
        var l = gl.getAttribLocation(prog, a);
        if (l == -1) {
            alert (attribNames[i] + " attribute not found in program!");
            return;
        }
        attribTypes[l] = attribs[a];
    }
    prog.attribs = attribTypes;
}

export function setUniformLocs(gl, prog, uniformNames) {
    var locs = [];
    for (var i = 0; i < uniformNames.length; ++i) {
        var l = gl.getUniformLocation(prog, uniformNames[i]);
        if (l == -1) {
            alert (uniformNames[i] + " uniform not found in program!");
            return;
        }
        locs.push(l);
    }
    prog.uniforms = locs;
}
