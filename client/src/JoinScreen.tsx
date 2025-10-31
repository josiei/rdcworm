import { useState } from "react";

type Props = {
  onJoin: (data: { name: string; color: string; avatar: string }) => void;
};

const SAMPLE_AVATARS = [
  "/avatars/rdc-bloop.svg",
  "/avatars/rdc-cheesin.svg",
  "/avatars/rdc-morpheus.svg",
  "/avatars/rdc-pepe.svg",
  "/avatars/rdc-peanut.svg",
  "/avatars/rdc-sunglasses.svg",
  "/avatars/reba-straight-smile.svg",
];

const SILLY_NAMES = [
  "Wiggly Worm", "Slinky Snake", "Noodle Doodle", "Squiggly Boi",
  "Wormy McWormface", "Slither Master", "Danger Noodle", "Spaghetti Sam",
  "Curly Fry", "Twisty Turny", "Loop de Loop", "Bendy Wendy",
  "Sneaky Snek", "Wiggle Worm", "Squirmy Wormy", "Slippery Slope",
  "Noodle Knight", "Worm Wizard", "Serpent Steve", "Coily Boily",
  "Twirly Whirly", "Zigzag Zoe", "Wavy Gravy", "Loopy Lou",
  "Squiggle Squad", "Ribbon Racer", "Spiral Sam", "Curvy Cathy"
];

function getRandomName(): string {
  return SILLY_NAMES[Math.floor(Math.random() * SILLY_NAMES.length)];
}

export default function JoinScreen({ onJoin }: Props) {
  const [name, setName] = useState(getRandomName());
  const [color, setColor] = useState("#22cc88");
  const [avatar, setAvatar] = useState(SAMPLE_AVATARS[0]);

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        maxWidth: 480,
        margin: "12vh auto",
        padding: 24,
        borderRadius: 12,
        background: "rgba(0,0,0,0.35)",
        color: "white",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <h2 style={{ margin: 0 }}>Join Worm Room</h2>

      <label>
        <div>Name</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 8, borderRadius: 6 }}
        />
      </label>

      <label>
        <div>Color</div>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ width: 64, height: 32, padding: 0, border: "none" }}
        />
      </label>

      <div>
        <div>Avatar</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SAMPLE_AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              style={{
                border: avatar === a ? "2px solid #fff" : "2px solid transparent",
                borderRadius: 8,
                padding: 2,
                background: "transparent",
                cursor: "pointer",
              }}
              title={a.split("/").pop()}
            >
              <img src={a} width={48} height={48} alt="" />
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onJoin({ name, color, avatar })}
        style={{
          marginTop: 8,
          padding: "10px 14px",
          borderRadius: 8,
          background: "#22cc88",
          color: "#001015",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Join
      </button>
    </div>
  );
}
