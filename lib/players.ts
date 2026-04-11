export interface Player {
  id: string;
  name: string;
  displayName: string;
  image: string;
  gender: "male" | "female";
}

export interface Pair {
  male: Player;
  female: Player;
}

export interface Team {
  seed: number;
  pair: Pair;
  name: string;
}

export const malePlayers: Player[] = [
  {
    id: "a-dung-gia",
    name: "Dũng Lớn",
    displayName: "a Dũng Lớn",
    image: "/hinhmn/a-dung-gia.jpeg",
    gender: "male",
  },
  {
    id: "a-dung",
    name: "Dũng",
    displayName: "a Dũng nhỏ",
    image: "/hinhmn/a-dung.jpeg",
    gender: "male",
  },
  {
    id: "a-duy",
    name: "Duy",
    displayName: "a Duy",
    image: "/hinhmn/a-duy.jpeg",
    gender: "male",
  },
  {
    id: "a-phap",
    name: "Pháp",
    displayName: "a Pháp",
    image: "/hinhmn/a-phap.jpeg",
    gender: "male",
  },
  {
    id: "a-thin",
    name: "Thìn",
    displayName: "a Thình",
    image: "/hinhmn/a-thin.jpeg",
    gender: "male",
  },
  {
    id: "a-tuyen",
    name: "Tuyến",
    displayName: "a Tuyến",
    image: "/hinhmn/a-tuyen.jpeg",
    gender: "male",
  },
  {
    id: "a-bao",
    name: "Bảo",
    displayName: "a Bảo",
    image: "/hinhmn/a-bao.jpeg",
    gender: "male",
  },
  {
    id: "a-phat",
    name: "Phát",
    displayName: "a Phát",
    image: "/hinhmn/player-placeholder.svg",
    gender: "male",
  },
  {
    id: "a-the",
    name: "Thế",
    displayName: "a Thế",
    image: "/hinhmn/player-placeholder.svg",
    gender: "male",
  },
];

export const femalePlayers: Player[] = [
  {
    id: "c-kieu",
    name: "Kiều",
    displayName: "c Kiều",
    image: "/hinhmn/c-kieu.jpeg",
    gender: "female",
  },
  {
    id: "c-me",
    name: "Thiên",
    displayName: "Thiên",
    image: "/hinhmn/c-me.jpg",
    gender: "female",
  },
  {
    id: "c-quynh",
    name: "Quỳnh",
    displayName: "c Quỳnh",
    image: "/hinhmn/c-quynh.jpeg",
    gender: "female",
  },
  {
    id: "c-thao",
    name: "Thảo",
    displayName: "c Ngô Thảo",
    image: "/hinhmn/c-thao.jpeg",
    gender: "female",
  },
  {
    id: "c-thu",
    name: "Thư",
    displayName: "c Thu Julie",
    image: "/hinhmn/c-thu.jpeg",
    gender: "female",
  },
  {
    id: "c-truc",
    name: "Trúc",
    displayName: "c Trúc",
    image: "/hinhmn/c-truc.jpeg",
    gender: "female",
  },
  {
    id: "c-thanh-thao",
    name: "Thanh Thảo",
    displayName: "c Thanh Thảo",
    image: "/hinhmn/c-thanh-thao.jpeg",
    gender: "female",
  },
  {
    id: "c-le",
    name: "Lệ",
    displayName: "c Lệ",
    image: "/hinhmn/player-placeholder.svg",
    gender: "female",
  },
  {
    id: "c-quy",
    name: "Quý",
    displayName: "c Quý",
    image: "/hinhmn/player-placeholder.svg",
    gender: "female",
  },
];

export function getTeamName(pair: Pair): string {
  return `${pair.male.displayName} & ${pair.female.displayName}`;
}
