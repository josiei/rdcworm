export function wrapCoord(x, size) {
    return (x + size) % size;
}
// shortest signed delta on a wrap world (so 2999->5 across width 3000 is -6)
export function wrapDelta(d, size) {
    if (d > size / 2)
        return d - size;
    if (d < -size / 2)
        return d + size;
    return d;
}
export function torusDelta(a, b, size) {
    return wrapDelta(b - a, size);
}
export function torusDistSq(a, b, w) {
    const dx = wrapDelta(b.x - a.x, w.width);
    const dy = wrapDelta(b.y - a.y, w.height);
    return dx * dx + dy * dy;
}
// Project a world point into camera-local coords centered at `center`
export function projectPoint(p, center, world) {
    return {
        x: wrapDelta(p.x - center.x, world.width),
        y: wrapDelta(p.y - center.y, world.height),
    };
}
