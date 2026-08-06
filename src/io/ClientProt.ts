// Client → server opcodes for RS2 rev 377.
// Source of truth: vendor/engine/src/network/game/client/ClientGameProt.ts
// Cross-checked against vendor/client-java p1isaac sites.
// Java Protocol.field671 (CLIENTPROT_SCRAMBLE) is unused dead data in 377 Client — not ported.
export const enum ClientProt {
    NO_TIMEOUT = 40, // engine ClientGameProt.NO_TIMEOUT

    IDLE_TIMER = 202,
    EVENT_MOUSE_CLICK = 19,
    EVENT_MOUSE_MOVE = 171,
    EVENT_APPLET_FOCUS = 187,
    EVENT_CAMERA_POSITION = 140,
    EVENT_HAS_WINDOW = 78, // engine only; not used by Client.ts yet
    EVENT_SYNTH_ERROR = 80, // engine only; not used by Client.ts yet

    ANTICHEAT_OPLOGIC1 = 95,
    ANTICHEAT_OPLOGIC2 = 165,
    ANTICHEAT_OPLOGIC3 = 157,
    ANTICHEAT_OPLOGIC4 = 222,
    ANTICHEAT_OPLOGIC5 = 126,
    // 289-era Client.ts still references these; 377 Java/engine only has OPLOGIC1–5.
    // Values are unused placeholders (not registered on 377 engine) so names keep compiling.
    ANTICHEAT_OPLOGIC6 = -1,
    ANTICHEAT_OPLOGIC7 = -1,
    ANTICHEAT_OPLOGIC8 = -1,
    ANTICHEAT_OPLOGIC9 = -1,

    ANTICHEAT_CYCLELOGIC1 = 244,
    ANTICHEAT_CYCLELOGIC2 = 168,
    ANTICHEAT_CYCLELOGIC3 = 197,
    ANTICHEAT_CYCLELOGIC4 = 173,
    ANTICHEAT_CYCLELOGIC5 = 248,
    ANTICHEAT_CYCLELOGIC6 = 22,
    // 289-era only; not in 377 engine (CYCLELOGIC1–6 only).
    ANTICHEAT_CYCLELOGIC7 = -1,

    OPOBJ1 = 77,
    OPOBJ2 = 100,
    OPOBJ3 = 71,
    OPOBJ4 = 54,
    OPOBJ5 = 230,
    OPOBJT = 83,
    OPOBJU = 211,

    OPNPC1 = 112,
    OPNPC2 = 67,
    OPNPC3 = 13,
    OPNPC4 = 42,
    OPNPC5 = 8,
    OPNPCT = 104,
    OPNPCU = 57,

    OPLOC1 = 181,
    OPLOC2 = 241,
    OPLOC3 = 50,
    OPLOC4 = 136,
    OPLOC5 = 55,
    OPLOCT = 210,
    OPLOCU = 152,

    OPPLAYER1 = 245,
    OPPLAYER2 = 233,
    OPPLAYER3 = 194,
    OPPLAYER4 = 116,
    OPPLAYER5 = 45,
    OPPLAYERT = 31,
    OPPLAYERU = 143,

    OPHELD1 = 203,
    OPHELD2 = 24,
    OPHELD3 = 161,
    OPHELD4 = 228,
    OPHELD5 = 4,
    OPHELDT = 36,
    OPHELDU = 1,

    INV_BUTTON1 = 3,
    INV_BUTTON2 = 177,
    INV_BUTTON3 = 91,
    INV_BUTTON4 = 231,
    INV_BUTTON5 = 158,

    IF_BUTTON = 79,
    RESUME_PAUSEBUTTON = 226,
    CLOSE_MODAL = 110,
    RESUME_P_COUNTDIALOG = 75,
    TUT_CLICKSIDE = 119,
    RESUME_P_NAMEDIALOG = 206, // engine only; not used by Client.ts yet

    MAP_BUILD_COMPLETE = 6,
    MOVE_OPCLICK = 247,
    // engine name: REPORT_ABUSE (todo rename → SEND_SNAPSHOT); Client.ts uses SEND_SNAPSHOT
    SEND_SNAPSHOT = 184,
    MOVE_MINIMAPCLICK = 213,
    INV_BUTTOND = 123,
    IGNORELIST_DEL = 160,
    IGNORELIST_ADD = 217,
    IDK_SAVEDESIGN = 163,
    CHAT_SETMODE = 176,
    MESSAGE_PRIVATE = 227,
    FRIENDLIST_DEL = 141,
    FRIENDLIST_ADD = 120,
    CLIENT_CHEAT = 56,
    MESSAGE_PUBLIC = 49,
    MOVE_GAMECLICK = 28,
};
