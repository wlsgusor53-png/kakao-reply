exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { situation, tone, mode, length } = JSON.parse(event.body || '{}');

  if (!situation || !tone) {
    return { statusCode: 400, body: JSON.stringify({ error: '상황과 톤을 입력해주세요.' }) };
  }

  const toneGuide = {
    polite: `정중하지만 딱딱하지 않게. 예의는 갖추되 실제 사람이 쓸 법한 자연스러운 문장으로. "헤이", "안녕하세요!", "~드립니다", "소중한" 같은 과한 표현 절대 금지.`,
    friendly: `친한 사이에서 쓰는 편한 말투. 실제로 카톡 많이 쓰는 20~30대가 보낼 법한 문장으로. "헤이", "안녕~" 같은 어색한 시작 금지. ㅜㅜ, ㅋㅋ 같은 표현은 상황에 맞을 때만.`,
    witty: `재치있고 가볍게. 위트있는 표현이나 드립을 넣되 억지스럽지 않게. "헤이", "안녕~" 같은 어색한 시작 금지.`
  };

  const lengthGuide = {
    '짧게': '딱 한 문장. 최대 20자 이내. 핵심만. 인사나 부연 설명 없이.',
    '보통': '한두 문장. 너무 길지도 짧지도 않게. 30~50자 내외.',
    '길게': '세 문장 이상. 상황을 충분히 설명하고 감정이나 대안까지 담아서.'
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
- 절대 금지: "헤이", "안녕하세요!", AI스러운 표현
- 이모지: 없어도 됨. 꼭 필요할 때만 1개. 절대 남발 금지

다듬어진 메시지 본문만 출력. 설명이나 번호 없이.`;

  } else {
    prompt = `실제 한국인이 카카오톡에서 쓸 법한 자연스러운 답장 3개 만들어줘.

[상황]
${situation}

[말투]
${toneGuide[tone] || toneGuide.friendly}

[길이 - 3개 모두 동일하게 지킬 것]
한두 문장. 30~50자 내외. 너무 길지도 짧지도 않게. 3개 모두 비슷한 길이여야 함.

[규칙]
- 진짜 사람이 카톡 치는 것처럼 자연스럽게
- 절대 금지 표현: "헤이", "안녕하세요!", "~드립니다", "소중한 연락", "함께하고 싶습니다"
- AI가 쓴 것 같은 티 절대 금지
- 상황을 구체적으로 반영할 것
- 3개는 표현 방식만 다르게 (길이는 모두 비슷하게)
- 이모지: 없어도 됨. 꼭 자연스러울 때만 최대 1개. 남발 금지
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
        temperature: 0.95,
        messages: [
          {
            role: 'system',
            content: '너는 카카오톡 메시지 전문가야. 실제 한국인이 일상에서 쓰는 자연스러운 구어체로 답장을 만들어줘. AI스럽거나 딱딱한 표현은 절대 금지. 이모지는 꼭 필요할 때만 최대 1개. 답장 3개의 길이는 항상 비슷하게 맞춰줘.'
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
