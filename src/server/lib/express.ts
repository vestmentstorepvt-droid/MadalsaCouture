import { Router } from "../http/router";

// `express.Router()` for the ported route modules.
const express = {
  Router: (options: { mergeParams?: boolean } = {}) => new Router(options),
};

export default express;
