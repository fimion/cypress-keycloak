"use strict";

module.exports = {
  plugins: ["plugins/markdown"],
  source: {
    include: ["index.js"],
  },
  opts: {
    destination: "./out/",
    encoding: "utf8",
    private: true,
    recurse: true,
    template: "./node_modules/minami",
  },
};
