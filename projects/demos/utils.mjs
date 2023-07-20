"use strict";

import {vec2, vec3, vec4, mat3, mat4, quat} from "./gl-matrix.mjs";

// picking code that maps Screen → NDC → View
// returned point would be in the view space on the viewing plane
export function mapScreenToView(x, y, viewportWidth, viewportHeight, fovY) {
    let ar = viewportWidth / viewportHeight;
    var x_ = ((2 * x / viewportWidth) - 1) * ar;
    var y_ = (-2 * y / viewportHeight) + 1;
    var d = 1 / Math.tan(fovY / 2);
    return vec3.fromValues(x_, y_, -d);
}

export function getMidpoint(v1, v2) {
    var m = vec2.create();
    vec2.add(m, v1, v2);
    vec2.scale(m, m, 0.5);
    return m;
}

export function degToRad(deg) {
    return deg * Math.PI / 180;
}

export function clamp(x, l, u) {
    return Math.min(Math.max(x, l), u);
}

// cheaper alternative to mat4.invert when x is a rigid-body transform
export function invertRigidXform(x) {
    var x_ = mat4.create();
    mat4.transpose(x_, x);
    x_[3] = 0, x_[7] = 0, x_[11] = 0;
    var r_ = mat3.create();
    mat3.fromMat4(r_, x_);
    var t_ = vec3.fromValues(x[12], x[13], x[14]);
    vec3.transformMat3(t_, t_, r_);
    x_[12] = -t_[0], x_[13] = -t_[1], x_[14] = -t_[2];
    return x_;
}

// input: screen space points p1 and p2, viewport dimensions, vertical FoV, view
//        to world transform, should the rotation be twice the angle between the
//        vectors formed.
// output: versor (quaternion) represeting the rotation of a model from vector
//         w2 to w1, which are model space vectors calculated based on p2 & p1.
//
// Since p1 and p2 are screen space points, transforming them to view space and
// forming position vectors w.r.t. view space origin gives v1 and v2. Rotating
// the camera from v1 to v2 has the same effect visually as rotating the model
// from v2 to v1 i.e. w2 to w1 in world space. See figure below.
export function getVersor(p1, p2, viewportDims, fovY, Mw2v, doubleAngle) {
    // We need a quaternion that rotates v2 to v1, this will be multiplied to
    // the model's orientation quaternion to get the model's Mm2w. The
    // orientation quaternion, when converted to a matrix, gives the model's
    // basis in terms of the world's, Mm2w. Hence both the vectors v1 and v2
    // used to form the quaternion need also be in world space.

    // Just using the screen points as-is will not give the expected result
    // since we need the camera to always rotate around an axis that's
    // orthogonal to the eye vector i.e. we need the rotation axis to be either
    // view-up, view-right or their linear combination (in world space); the two
    // vectors calculated should be orthogonal to the plane spanned by view-up
    // and view-right; when used as-is it won't be so. See crystal_ball.jpg for
    // an illustration. Translate the screen points so that the line they form
    // have the screen centre as its midpoint.
    var m = getMidpoint(p1, p2);
    let viewportCentre = vec2.fromValues(viewportDims[0] / 2,
                                         viewportDims[1] / 2);
    vec2.sub(m, viewportCentre, m);
    vec2.add(p1, p1, m);
    vec2.add(p2, p2, m);
    var v1 = mapScreenToView(p1[0], p1[1],
                             viewportDims[0], viewportDims[1],
                             fovY);
    var v2 = mapScreenToView(p2[0], p2[1],
                             viewportDims[0], viewportDims[1],
                             fovY);
    var Mv2w = invertRigidXform(Mw2v);

    /*
      Although glMatrix has a vec3.transformMat4, the w component is implicitly
      assigned 1 i.e. treated as a point, while v1 and v2 are actually vectors.
      Within a space, treating points as position vectors is common; however,
      when transforming to a different space, the distinction is important. Two
      points a1 and a2 in space A, transformed, as points, into b1 and b2 of
      space B and considering their position vectors in that system would reveal
      that they point in very different directions than the vectors a1 and a2
      would. This discrepancy is due to the origin of the systems having a
      bearing in deciding the direction of the position vectors. Transforming
      vectors a1 and a2 with w = 0 to system B would give vectors pointing in
      the same direction but represented in B's terms. This is illustrated in
      the Position_Vectors.jpg calculation. Hence manually convert to maintain
      v1 and v2 as vectors.
    */
    var tv1 = vec4.fromValues(v1[0], v1[1], v1[2], 0);
    var tv2 = vec4.fromValues(v2[0], v2[1], v2[2], 0);
    vec4.transformMat4(tv1, tv1, Mv2w);
    vec4.transformMat4(tv2, tv2, Mv2w);
    v1 = vec3.fromValues(tv1[0], tv1[1], tv1[2]);
    v2 = vec3.fromValues(tv2[0], tv2[1], tv2[2]);

    /*
        now we've the two view space vectors in terms of world space; this is
        how the situtation looks: (v1 and v2 are vectors so their position in
        the figure doesn't matter)

            transformed v1 \   /  v2 in world space
                             +  -> world origin
                         -+-----+-  viewing plane, where +s are the click points
               original v1 \   /  v2 in view space
                             +   -> view origin

        Rotating from + to + (i.e. p1 to p2) w.r.t. world origin is the same as
        rotating from v2 to v1 w.r.t. world origin which is visually the same as
        rotating the view's basis from v1 to v2 w.r.t. view origin.
     */

    doubleAngle = (doubleAngle === undefined) ? true : doubleAngle;
    if (doubleAngle) {
        // make it twice the angle between v₁ and v₂ for greater rotation;
        // say v₁ sweeped twice the angle is a new vector v₃, then we know
        // v₂ = (v₁ + v₃) / 2, thus we have v₃ = 2v₂ − v₁
        vec3.scale(v2, v2, 2);
        vec3.sub(v2, v2, v1);
    }

    vec3.normalize(v1, v1);
    vec3.normalize(v2, v2);
    var versor = quat.create();
    quat.rotationTo(versor, v2, v1);
    return versor;
}
