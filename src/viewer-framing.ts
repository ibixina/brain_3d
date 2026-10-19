export function perspectiveFraming(aspect: number, verticalFov = 36) {
  const verticalHalfAngle = (verticalFov * Math.PI) / 360;
  const limitingHalfAngle = Math.atan(
    Math.tan(verticalHalfAngle) * Math.min(1, aspect),
  );
  return Math.sin(verticalHalfAngle) / Math.sin(limitingHalfAngle);
}

export function sphereFocusDistance(radius: number, framing: number, minimum = 35) {
  return Math.max(radius * 3.6, minimum) * framing;
}
