import { WebSocc } from "../lib/soccc";
import type { Sck } from "../../backend/src/syncc";

const url = new URL(window.location.href);
url.protocol = url.protocol.replace("http", "ws");
url.pathname = "ws";

const socc = new WebSocc<Sck["tRecv"], Sck["tSend"]>(url);

socc.on("open", () => {
    console.log("opened connection, saying hello");
    socc.send("test", { hello: "world" });
});

socc.on("test", (body) => {
    console.log("got hello", body);
});

socc.on("close", (r) => {
    console.log("closed", r);
});
