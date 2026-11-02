function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function paragraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function sectionHtml(section) {
  const heading = `<h2>${escapeHtml(section.heading)}</h2>`;
  const image = section.imageSlot
    ? `<p><em>[이미지: ${escapeHtml(section.imageSlot)}]</em></p>`
    : "";

  if (section.kind === "list" && section.listItems?.length) {
    const items = section.listItems
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    return `${heading}\n${image}\n<ul>${items}</ul>\n${paragraphs(section.body)}`;
  }

  return `${heading}\n${image}\n${paragraphs(section.body)}`;
}

export function draftToHtml(draft) {
  const parts = [paragraphs(draft.lead), ...draft.sections.map(sectionHtml)];
  if (draft.internalLinkHint) {
    parts.push(`<p>함께 보면 좋은 글: ${escapeHtml(draft.internalLinkHint)}</p>`);
  }
  return parts.join("\n\n");
}

export const TITLE = "블로그를 대신 작성해 드립니다. 그 글을 보는 전용 앱까지요.";

export const TITLES = [
  TITLE,
  "블로그 대행만 맡기면, 뭐가 올라갔는지 모릅니다",
  "네이버 블로그 대행, 전용 앱에서 글을 보는 방식",
];

export const LEAD = `바이브앱투데이의 주력은 네이버 블로그 광고 대행입니다.
기존 대행과 다른 점은 하나입니다. 글을 쓰고 끝나는 게 아니라, 사장님 매장 전용 앱을 드립니다.`;

export const SECTIONS = [
  {
    heading: "블로그 대행을 맡겼는데, 뭐가 올라갔는지 모릅니다",
    kind: "text",
    body: `블로그 대행을 쓰면 보통 이렇게 됩니다. 카톡으로 원고가 오고, 사진이 오고, “발행했습니다” 한 줄이 옵니다. 사장님은 네이버에 들어가 찾아봐야 하고, 직원이 남긴 수정은 또 다른 톡방에 묻힙니다.

글은 올라갔는데, 매장 운영과 마케팅이 따로 놉니다. 그게 기존 대행입니다.`,
    imageSlot: "카톡으로 흩어진 원고·사진·발행 알림을 한눈에 보여주는 화면(선택)",
  },
  {
    heading: "우리는 글을 대신 씁니다. 차이는 그다음입니다",
    kind: "text",
    body: `업종·지역 키워드를 잡고, 원고를 쓰고, 사진을 정리하고, 네이버 블로그에 발행합니다. 카페라면 신메뉴·자리 안내·비 오는 날 이용 팁처럼, 손님이 검색해서 들어오는 글을 매달 이어서 만듭니다.

여기까지는 다른 대행도 한다고 말합니다. 차이는 그다음입니다.`,
  },
  {
    heading: "올린 글은 전용 앱에서 어떻게 보나요?",
    kind: "list",
    listItems: [
      "이번 달 몇 편을 발행했는지",
      "발행 전, 사장님 확인이 필요한 초안",
      "작성된 글의 누적 조회",
      "최근 의견 — 수정 한 줄, 반영 한 줄",
      "다음에 쓰고 싶은 아이디어",
      "매장에 이미 켜 둔 기능, 추가로 넣고 싶은 기능",
    ],
    body: `대행을 맡기시면 매장 이름 그대로의 전용 앱을 드립니다. 사장님은 앱만 열면 됩니다.

카톡에서 파일을 찾지 않아도 됩니다. “이 문장만 넣어 주세요” 한 줄이면, 반영하고 발행한 기록이 앱에 남습니다.`,
    imageSlot:
      "한옥카페 월하 전용 앱 블로그 현황 화면(01-store-app.png). 시연용이며 특정 매장 계약 실적이 아닙니다.",
  },
  {
    heading: "화면 예시는 어떤가요?",
    kind: "text",
    body: `아래는 카페 매장용으로 구성한 전용 앱 예시입니다. 블로그 현황, 확인 요청, 조회수, 최근 의견이 한 화면에 있습니다.

시연 화면: https://store-hq-ljh.web.app/
특정 매장 계약 실적이 아닙니다. 화면 구성을 보여 드리기 위한 예시입니다.`,
  },
  {
    heading: "의견 한 줄이 글로 다시 붙습니다",
    kind: "text",
    body: `예를 들면 이런 식입니다. 사장님이 “예약 문단에, 비 오면 마당 자리는 처마 아래로 옮겨 드립니다 — 이 한 줄만 넣어 주세요”라고 앱에 남깁니다. 대행은 반영해서 발행하고, “조회수는 이 앱 현황에서 보시면 됩니다”라고 남깁니다.

글이 일방적으로 올라가지 않습니다. 매장 사람이 아는 한 줄이, 검색하는 손님에게 보이는 문장이 됩니다.`,
  },
  {
    heading: "글만 아니라, 매장 기능도 넣을 수 있나요?",
    kind: "text",
    body: `블로그를 보다 보면 반복 업무가 보입니다. 예약 확인, 입금 알림, 자리 안내처럼요. 그때 전용 앱에 매장 기능을 추가합니다. 마케팅 대행과 운영 앱을 업체가 따로 쓰지 않아도 됩니다.

구성은 매장마다 맞추고, 금액은 별도 협의입니다.`,
  },
  {
    heading: "이런 사장님께 맞습니다",
    kind: "list",
    listItems: [
      "블로그는 맡기고 싶은데, 뭐가 올라갔는지 매번 찾기 싫으신 분",
      "카톡으로 수정하다 지치신 분",
      "카페·병의원·학원·주택처럼, 지역 검색이 손님을 만드는 업종",
      "글과 매장 운영을 한곳에서 보고 싶은 분",
    ],
    body: `바이브앱투데이는 블로그를 대신 작성합니다. 차별화는 전용 앱입니다. 글을 보고, 의견을 나누고, 아이디어를 남기고, 필요한 기능을 더합니다.

문의: contact@heartlinktoday.com
카카오톡: https://pf.kakao.com/_Bxgtxgn/chat
공식 사이트: https://www.vibeapptoday.com/`,
  },
];

export const TAGS = [
  "블로그대행",
  "네이버블로그",
  "매장앱",
  "바이브앱투데이",
  "소상공인마케팅",
];

export function buildHtml() {
  return draftToHtml({
    lead: LEAD,
    sections: SECTIONS,
    internalLinkHint: "",
  });
}
