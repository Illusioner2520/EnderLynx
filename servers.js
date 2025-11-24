const net = require("net");

function readVarInt(buffer, offset = 0) {
    let num = 0;
    let shift = 0;
    let pos = offset;

    while (true) {
        let byte = buffer[pos++];
        num |= (byte & 0x7F) << shift;
        shift += 7;
        if ((byte & 0x80) !== 0x80) break;
        if (shift > 35) throw new Error("VarInt too big");
    }
    return { value: num, size: pos - offset };
}

function writeVarInt(value) {
    const bytes = [];
    do {
        let temp = value & 0x7F;
        value >>>= 7;
        if (value !== 0) temp |= 0x80;
        bytes.push(temp);
    } while (value !== 0);
    return Buffer.from(bytes);
}

function createHandshakePacket(host, port, protocol = 47) {
    const hostBuf = Buffer.from(host, "utf8");
    const packet = Buffer.concat([
        writeVarInt(0x00),
        writeVarInt(protocol),
        writeVarInt(hostBuf.length),
        hostBuf,
        Buffer.from([(port >> 8) & 0xFF, port & 0xFF]),
        writeVarInt(1)
    ]);

    return Buffer.concat([writeVarInt(packet.length), packet]);
}

function createRequestPacket() {
    const inner = writeVarInt(0x00);
    return Buffer.concat([writeVarInt(inner.length), inner]);
}

async function queryServer(host, port = 25565, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection(port, host);

        let dataBuffer = Buffer.alloc(0);

        socket.setTimeout(timeout);
        socket.on("timeout", () => {
            socket.destroy();
            reject(new Error("Request timed out."));
        });

        socket.on("error", reject);

        socket.on("connect", () => {
            socket.write(createHandshakePacket(host, port));
            socket.write(createRequestPacket());
        });

        socket.on("data", (chunk) => {
            dataBuffer = Buffer.concat([dataBuffer, chunk]);

            try {
                const { value: packetLength, size: size1 } = readVarInt(dataBuffer);
                if (dataBuffer.length < packetLength + size1) return;

                const { value: packetId, size: size2 } = readVarInt(dataBuffer, size1);
                if (packetId !== 0x00) return reject(new Error("Unexpected packet ID."));

                const { value: jsonLength, size: size3 } = readVarInt(dataBuffer, size1 + size2);
                const start = size1 + size2 + size3;

                const json = dataBuffer.slice(start, start + jsonLength).toString("utf8");
                const parsed = JSON.parse(json);

                socket.destroy();

                resolve({
                    motd_raw: parsed.description,
                    motd_stripped: stripMotd(parsed.description),
                    favicon: parsed.favicon || null,
                    version: parsed.version?.name,
                    protocol: parsed.version?.protocol,
                    players: {
                        online: parsed.players?.online,
                        max: parsed.players?.max,
                        sample: parsed.players?.sample || []
                    },
                    full_data: parsed
                });
            } catch {}
        });
    });
}

function stripMotd(desc) {
    if (typeof desc === "string") {
        return desc.replace(/§[0-9A-FK-OR]/gi, "");
    }
    if (typeof desc === "object") {
        return extractJsonText(desc).replace(/§[0-9A-FK-OR]/gi, "");
    }
    return "";
}

function extractJsonText(obj) {
    let result = "";
    if (obj.text) result += obj.text;
    if (Array.isArray(obj.extra))
        for (const e of obj.extra) result += extractJsonText(e);
    return result;
}

module.exports = { queryServer };