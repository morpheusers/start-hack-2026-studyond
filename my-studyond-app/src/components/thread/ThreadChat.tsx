import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAppStore } from '@/store/useAppStore';
import { getInitialsColor, getInitialsFromName } from '@/data/mockMatches';
import type { Thread, ThreadMessage } from '@/types';

// Send a thread-specific chat message (mode=thread, no match cards returned)
async function generateThreadResponse(
  thread: Thread,
  userMessage: string,
  systemContext: string
): Promise<string> {
  try {
    const { card } = thread;
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'thread',
        systemContext,
        threadContext: {
          entityName: card.name,
          entityType: card.entityType,
          topicTitle: card.topicTitle,
          description: card.description,
          tags: card.tags,
        },
        messages: [{ role: 'user', parts: [{ type: 'text', text: userMessage }], id: 'msg-1' }],
      }),
    });

    if (!response.ok) throw new Error('API error');

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');

    let fullText = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      // Parse Vercel AI SDK UIMessageStream format — text parts are prefixed with "0:"
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('0:')) {
          try {
            const content = JSON.parse(line.slice(2));
            if (typeof content === 'string') fullText += content;
          } catch {
            // skip malformed lines
          }
        }
      }
    }
    return fullText.trim() || 'I couldn\'t generate a response. Please try again.';
  } catch {
    const { card } = thread;
    const fallbacks = [
      `Great question about ${card.name}! Based on your profile, this opportunity aligns well with your ${card.tags[0]?.replace('#', '') ?? 'background'}. I'd recommend reaching out directly to express your interest.`,
      `For the ${card.topicTitle ?? 'thesis topic'}, the key skills you'd need include: ${card.tags.slice(0, 3).join(', ')}. Your current skillset covers most of these well.`,
      `The timeline for this kind of thesis is typically 5-6 months. You'd likely spend the first 2 months on literature review and methodology, then 3-4 months on implementation and analysis.`,
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

interface ThreadChatProps {
  thread: Thread;
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="size-7 rounded-full bg-ai flex items-center justify-center flex-shrink-0">
        <Sparkles className="size-3.5 text-white" />
      </div>
      <div className="chat-bubble-ai flex gap-1 items-center py-3">
        <span className="typing-dot size-1.5 bg-muted-foreground rounded-full" />
        <span className="typing-dot size-1.5 bg-muted-foreground rounded-full" />
        <span className="typing-dot size-1.5 bg-muted-foreground rounded-full" />
      </div>
    </div>
  );
}

export function ThreadChat({ thread }: ThreadChatProps) {
  const { profile, addMessageToThread, markThreadRead, buildSystemContext } = useAppStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initials = thread.card.initials ?? getInitialsFromName(thread.card.name);
  const colorClass = getInitialsColor(initials);

  useEffect(() => {
    markThreadRead(thread.id);
  }, [thread.id, markThreadRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    setInput('');
    setIsLoading(true);

    const userMessage: ThreadMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };
    addMessageToThread(thread.id, userMessage);

    const responseText = await generateThreadResponse(thread, userText, buildSystemContext());

    const assistantMessage: ThreadMessage = {
      id: `msg-${Date.now()}-ai`,
      role: 'assistant',
      content: responseText,
      timestamp: new Date(),
    };
    addMessageToThread(thread.id, assistantMessage);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const SUGGESTED = [
    'What skills do I need for this?',
    'How long does this thesis typically take?',
    'How should I reach out?',
    'What does the research process look like?',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <AnimatePresence initial={false}>
          {thread.messages.map((message) => {
            const isUser = message.role === 'user';
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
              >
                {!isUser ? (
                  <Avatar className={`size-7 flex-shrink-0 ${colorClass}`}>
                    <AvatarFallback className={`text-xs font-semibold ${colorClass}`}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="size-7 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {profile.firstName[0]}{profile.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[80%] ${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
                  <p className="ds-body whitespace-pre-wrap">{message.content}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isLoading && <TypingIndicator />}

        {/* Suggested replies after first message */}
        {thread.messages.length === 1 && !isLoading && (
          <div className="space-y-2 pl-9">
            <p className="ds-caption text-muted-foreground">Quick questions:</p>
            <div className="flex flex-col gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted transition-colors ds-small text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-border">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${thread.card.name}...`}
            className="flex-1 resize-none rounded-xl min-h-[44px] max-h-[100px]"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="rounded-full size-11 bg-ai hover:opacity-90 flex-shrink-0"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
