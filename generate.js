exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { situation, tone, mode, length } = JSON.parse(event.body || '{}');

  if (!situation || !tone) {
    return { statusCode: 400, body: JSON.stringify({ error: '상황과 톤을 입력해주세요.' }) };
  }

  const toneGuide = {
    polite: `정중하지만 딱딱하지 않게. 예의는 갖추되 실제 사람이 쓸 법한 자연스러운 문장으로. 너무 격식체는 피하고, 따뜻하고 진심이 느껴지게.`,
    friendly: `친한 사이에서 쓰는 편한 말투. 축약어나 ㅜㅜ, ㅋㅋ 같은 표현도 자연스럽게 써도 됨. 실제로 카톡 많이 쓰는 20~30대가 보낼 법한 문장으로.`,
    witty: `재치있고 가볍게. 위트있는 표현이나 드립을 넣되 억지스럽지 않게. 읽으면 피식 웃음 나올 정도의 센스있는 문장으로.`
  };

  const lengthGuide = {
    '짧게': '한 문장 이내로. 핵심만 간결하게.',
    '보통': '한두 문장으로. 너무 길지도 짧지도 않게.',
    '길게': '두세 문장으로. 내용을 충분히 담아서.'
  };

  let prompt;

  if (mode === 'refine') {
    const lengthInstruction = length ? (lengthGuide[length] || lengthGuide['보통']) : lengthGuide['보통'];
    prompt = `아래 카카오톡 메시지를 더 자연스럽게 다듬어줘.

[원본]
${situation}

[조건]
- 말투: ${toneGuide[tone] || toneGuide.friendly}
- 길이: ${lengthInstruction}
- 원본의 의도는 유지하면서 실제 사람이 보낸 것처럼 자연스럽게
- AI가 쓴 것 같은 티 나는 표현 금지 (예: "~드립니다", "~하여", "소중한", "함께하다" 같은 딱딱한 표현 쓰지 말 것)
- 이모지는 과하지 않게 1~2개

다듬어진 메시지 본문만 출력. 설명이나 번호 없이.`;

  } else {
    prompt = `실제 한국인이 카카오톡에서 쓸 법한 자연스러운 답장 3개 만들어줘.

[상황]
${situation}

[말투]
${toneGuide[tone] || toneGuide.friendly}

[규칙]
- 진짜 사람이 카톡 치는 것처럼 자연스럽게
- AI가 쓴 것 같은 티 절대 금지
  → 금지 표현: "~드립니다", "~하여", "소중한 연락", "함께하고 싶습니다", "진심으로 바랍니다" 등 딱딱하거나 과한 표현
  → 금지 패턴: 너무 완벽한 문장 구조, 과한 존댓말, 문어체
- 상황을 구체적으로 반영할 것
- 3개는 서로 다른 방식으로 (길이, 뉘앙스, 접근법 다르게)
- 각 답장은 1~3문장으로 짧고 간결하게
- 이모지는 상황에 맞게 자연스럽게 (없어도 됨)
- 번호, 따옴표, 설명 없이 본문만
- 각 답장은 "---" 로 구분

출력:
첫 번째 답장
---
두 번째 답장
---
세 번째 답장`;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        temperature: 1.0,
        messages: [
          {
            role: 'system',
            content: '너는 카카오톡 메시지 전문가야. 실제 한국인이 일상에서 쓰는 자연스러운 구어체로 답장을 만들어줘. AI스럽거나 딱딱한 표현은 절대 쓰지 마.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { statusCode: res.status, body: JSON.stringify({ error: err?.error?.message || 'OpenAI 오류가 발생했어요.' }) };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';

    let replies;
    if (mode === 'refine') {
      replies = [raw];
    } else {
      const parts = raw.split(/\n?---\n?/).map(s => s.trim()).filter(s => s.length > 0);
      replies = parts.slice(0, 3);
      while (replies.length < 3) replies.push(replies[replies.length - 1]);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replies })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: '서버 오류가 발생했어요. 다시 시도해주세요.' }) };
  }
};
