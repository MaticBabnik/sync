# Sync

"shitty-"sync minus the "shitty" part

#### Global TODOs

-   linter

## Components

I am unhappy with existing libraries/frameworks so I'm reinventing all the wheels.

### Socc

`backend/lib/Socc.ts`, `client/lib/soccc.ts`

An end-to-end typesafe and validated WebSocket solution.

#### TODOs

-   expose websocket settings

### Routeher

`backend/Routeher.ts`

A very limited JSON oriented HTTP router.

Mostly designed to be ergonomic on the backend (no end to end type safety here)

#### TODOs

-   tests probably
-   test validators
-   middleware

## API

For now this is just my personal scratchpad for API design.

### Connect to Websocket

`GET /room/create/:slug`
`GET /room/join/:slug`
`GET /room/join/:slug?key="keyIfPrivate"`
`GET /room/reconnect/:slug?key="sessionKey"`

### Id

You get an ID when you connect.

```plain
<- id { id: number }
```

### Sync time

Kinda like NTP, try to fire off atleast 3. Take the shortest response's time difference.

```plain
-> time {}
<- time {t2: number}
```

### Ready

Emitting this event subscibes you to the room's topic.
You will also recive an init event with the room state.

```plain
-> ready {displayName: string, gravatar: string}
<- init {state: RoomState}
```

#### Room Events

```plain
<- userJoin {}
<- userUpdate {}
<- userDisconnect {}
<- userLeave {}

<- chatMessage {msg: ChatMessage}

<- playlistUpdated {playlist: PlaylistEntry[]}
<- sync {ps: PlayState}
```

### Sync

Admins can emit sync events;
Sync events contain a playstate;

```plain
-> sync {ps: PlayState}
```

### Room settings

```
-> updateRoom {description: string}
-> regenKey
```
