exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { situation, tone, mode, length } = JSON.parse(event.body || '{}');

  if (!situation || !tone) {
    return { statusCode: 400, body: JSON.stringify({ error: '상황과 톤을 입력해주세요.' }) };
  }

  const toneGuide = {
    polite: '정중하고 격식 있는 말투. 존댓말 사용. 완곡하고 배려 있는 표현.',
    friendly: '친근하고 자연스러운 말투. 편한 관계에서 쓰는 따뜻한 표현.',
    witty: '재치 있고 유머러스한 말투. 센스 있는 표현. 가볍고 재미있게.'
  };

  const lengthGuide = {
    '짧게': '1문장 이내로 아주 짧고 간결하게.',
    '보통': '1~2문장으로 자연스럽게.',
    '길게': '2~4문장으로 충분히 내용을 담아서.'
  };

  let prompt;

  if (mode === 'refine') {
    const lengthInstruction = length ? (lengthGuide[length] || lengthGuide['보통']) : lengthGuide['보통'];
    prompt = `다음 카카오톡 메시지를 더 자연스럽고 매끄럽게 다듬어줘.

[원본 메시지]
${situation}

[다듬기 조건]
- 말투: ${toneGuide[tone] || toneGuide.friendly}
- 길이: ${lengthInstruction}
- 원본의 핵심 의도는 유지하되 더 자연스럽게
- 이모지 적절히 사용

다듬어진 메시지 본문만 출력해줘. 설명, 번호, 따옴표 없이.`;

  } else {
    prompt = `너는 카카오톡 메시지를 잘 쓰는 한국인 전문가야.

[상황]
${situation}

[요청]
위 상황에 맞는 카카오톡 답장 3개를 만들어줘.

[답장 스타일]
${toneGuide[tone] || toneGuide.friendly}

[규칙]
- 각 답장은 실제 카카오톡에서 바로 보낼 수 있는 자연스러운 한국어
- 상황을 구체적으로 반영할 것
- 3개는 서로 다른 방식으로 표현 (길이, 뉘앙스, 접근법 다르게)
- 각 답장은 1~3문장 이내로 짧고 간결하게
- 이모지 적절히 사용 (과하지 않게)
- 번호, 따옴표, 설명 없이 답장 본문만 출력
- 각 답장은 반드시 "---" 로 구분

출력 형식:
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
        temperature: 0.9,
        messages: [
          { role: 'system', content: '너는 카카오톡 메시지 전문가야. 한국어로 자연스러운 답장을 만들어줘.' },
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
