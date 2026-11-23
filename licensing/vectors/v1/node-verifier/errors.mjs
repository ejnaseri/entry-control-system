export class NodeVectorFailure extends Error {
  constructor(stage, code, message = code) {
    super(message);
    this.name = "NodeVectorFailure";
    this.stage = stage;
    this.code = code;
  }
}

export function reject(stage, code, message) {
  throw new NodeVectorFailure(stage, code, message);
}
