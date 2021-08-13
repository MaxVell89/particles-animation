export const getRandom = function (from, to) {
    return Math.random() * (to - from) + from;
};

export const getRandom2 = (from, to) => {
    return Math.floor(from + Math.random() * (to - from + 1));
}

export const getDistance = (x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

export const degToRad = (deg) =>  {
    return deg * Math.PI / 180;
}

export const deNormalize = (normValue, start, end) => {
    return start + normValue * (end - start);
};