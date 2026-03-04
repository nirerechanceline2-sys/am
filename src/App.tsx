/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Plus, 
  MessageSquare, 
  Menu, 
  X, 
  Send, 
  User, 
  Bot, 
  Trash2,
  Settings,
  LogOut,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Copy,
  ThumbsUp,
  RotateCcw,
  Eye,
  Code,
  ThumbsDown,
  Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "./lib/utils";
import { sendMessageStream, Message } from "./services/geminiService";

const HTMLPreview = ({ code }: { code: string }) => {
  const [showPreview, setShowPreview] = useState(false);
  
  return (
    <div className="my-4 border border-border rounded-xl overflow-hidden bg-white">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-border">
        <span className="text-xs font-medium text-gray-500">HTML Preview</span>
        <button 
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-200 text-xs font-medium transition-colors"
        >
          {showPreview ? <Code size={14} /> : <Eye size={14} />}
          {showPreview ? "Show Code" : "Show Preview"}
        </button>
      </div>
      {showPreview ? (
        <iframe
          srcDoc={code}
          title="HTML Preview"
          className="w-full min-h-[300px] bg-white"
          sandbox="allow-scripts"
        />
      ) : (
        <pre className="p-4 text-xs font-mono bg-gray-900 text-gray-100 overflow-x-auto">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ id: string; title: string }[]>([]);
  const abortControllerRef = useRef<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (overrideInput?: string) => {
    const textToSend = overrideInput || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: textToSend,
      id: Date.now().toString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideInput) setInput("");
    setIsLoading(true);

    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      role: "model",
      content: "",
      id: aiMessageId,
    };

    setMessages((prev) => [...prev, aiMessage]);
    abortControllerRef.current = false;

    try {
      let fullContent = "";
      const stream = sendMessageStream([...messages, userMessage]);
      
      for await (const chunk of stream) {
        if (abortControllerRef.current) break;
        
        if (chunk.type === "image") {
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === aiMessageId ? { ...msg, type: "image", imageData: chunk.data, content: "Generated image:" } : msg
            )
          );
        } else {
          fullContent += chunk.data;
          setMessages((prev) => 
            prev.map((msg) => 
              msg.id === aiMessageId ? { ...msg, content: fullContent } : msg
            )
          );
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
    if (lastUserMessage) {
      setMessages(prev => prev.slice(0, -1)); // Remove last AI response
      handleSend(lastUserMessage.content);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const startNewChat = () => {
    if (messages.length > 0) {
      setChatHistory(prev => [
        { id: Date.now().toString(), title: messages[0].content.slice(0, 30) + "..." },
        ...prev
      ]);
    }
    setMessages([]);
  };

  const clearHistory = () => {
    setChatHistory([]);
  };

  const stopGenerating = () => {
    abortControllerRef.current = true;
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen bg-chat-bg text-gray-900 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(true)}
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className={cn(
          "bg-sidebar-bg flex flex-col z-30 transition-all duration-300 ease-in-out border-r border-border",
          !isSidebarOpen && "pointer-events-none"
        )}
      >
        <div className="p-3 flex flex-col h-full">
          <button
            onClick={startNewChat}
            className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border hover:bg-black/5 transition-colors mb-4 text-gray-700"
          >
            <Plus size={16} />
            <span className="text-sm font-medium">New chat</span>
          </button>

          <div className="flex-1 overflow-y-auto space-y-1">
            <div className="text-xs font-semibold text-gray-400 px-3 py-2 uppercase tracking-wider">
              Recent
            </div>
            {chatHistory.map((chat) => (
              <button
                key={chat.id}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors text-sm text-gray-600 group"
              >
                <MessageSquare size={16} className="shrink-0" />
                <span className="truncate">{chat.title}</span>
              </button>
            ))}
            {chatHistory.length > 0 && (
              <button
                onClick={clearHistory}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors text-sm mt-2"
              >
                <Trash2 size={16} />
                <span>Clear history</span>
              </button>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-border space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-black/5 transition-colors text-sm text-gray-700">
              <Settings size={16} />
              <span>Settings</span>
            </button>
            <div className="flex items-center gap-3 px-3 py-2 mt-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                U
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate text-gray-900">User Account</p>
                <p className="text-xs text-gray-500 truncate">Free Plan</p>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="h-14 flex items-center px-4 border-b border-border sticky top-0 bg-chat-bg/80 backdrop-blur-md z-10">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-black/5 rounded-lg transition-colors mr-2 text-gray-600"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 font-bold text-xl text-black">
            <span>AM</span>
            <ChevronDown size={16} className="text-gray-400" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors text-xs font-medium text-gray-700">
              <Sparkles size={14} className="text-yellow-600" />
              Upgrade
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center max-w-5xl mx-auto">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mb-6 border border-border"
              >
                <Bot size={32} className="text-gray-600" />
              </motion.div>
              <h1 className="text-3xl font-bold mb-4 text-gray-900">How can I help you today?</h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-8">
                {[
                  "Plan a trip to Tokyo",
                  "Write a Python script for data analysis",
                  "Explain quantum computing",
                  "Suggest a healthy dinner recipe"
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="p-4 text-left rounded-xl border border-border hover:bg-black/5 transition-all text-sm font-semibold text-gray-500 hover:text-gray-900"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex flex-col gap-2 group animate-in fade-in slide-in-from-bottom-2 duration-300",
                    message.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[90%] rounded-2xl px-5 py-4 text-sm font-semibold",
                      message.role === "user" 
                        ? "bg-user-msg text-gray-900 shadow-sm" 
                        : "bg-ai-msg text-gray-800"
                    )}
                  >
                    <div className="markdown-body">
                      {message.type === "image" && message.imageData ? (
                        <div className="space-y-2">
                          <p className="mb-2 text-gray-500 italic">Generated Image:</p>
                          <img 
                            src={message.imageData} 
                            alt="Generated" 
                            className="rounded-xl max-w-full h-auto border border-border shadow-md"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || "");
                              const lang = match ? match[1] : "";
                              const codeString = String(children).replace(/\n$/, "");
                              
                              if (!inline && lang === "html") {
                                return <HTMLPreview code={codeString} />;
                              }
                              
                              return (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      )}
                    </div>
                    {message.role === "model" && isLoading && message.content === "" && (
                      <div className="flex gap-1 mt-2">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                      </div>
                    )}
                  </div>
                  
                  {message.role === "model" && message.content !== "" && (
                    <div className="flex items-center gap-1 ml-1 transition-opacity">
                      <button 
                        onClick={() => copyToClipboard(message.content)}
                        className="p-1.5 hover:bg-black/5 rounded text-gray-500 hover:text-gray-900 transition-colors"
                        title="Copy"
                      >
                        <Copy size={14} />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-black/5 rounded text-gray-500 hover:text-gray-900 transition-colors"
                        title="Like"
                      >
                        <ThumbsUp size={14} />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-black/5 rounded text-gray-500 hover:text-gray-900 transition-colors"
                        title="Dislike"
                      >
                        <ThumbsDown size={14} />
                      </button>
                      <button 
                        onClick={handleRegenerate}
                        className="p-1.5 hover:bg-black/5 rounded text-gray-500 hover:text-gray-900 transition-colors"
                        title="Regenerate"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  )}

                  {message.role === "user" && (
                    <div className="flex items-center gap-1 mr-1 transition-opacity">
                      <button 
                        onClick={() => copyToClipboard(message.content)}
                        className="p-1.5 hover:bg-black/5 rounded text-gray-500 hover:text-gray-900 transition-colors"
                        title="Copy"
                      >
                        <Copy size={14} />
                      </button>
                      <button 
                        className="p-1.5 hover:bg-black/5 rounded text-gray-500 hover:text-gray-900 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gradient-to-t from-chat-bg via-chat-bg to-transparent">
          <div className="max-w-5xl mx-auto relative">
            <div className="relative flex items-end w-full bg-white border border-border rounded-2xl focus-within:border-gray-400 shadow-sm transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message AM..."
                rows={1}
                className="w-full bg-transparent border-none focus:ring-0 resize-none py-4 px-4 text-sm max-h-60 custom-scrollbar text-gray-900"
                style={{ height: "auto" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
              {isLoading ? (
                <button
                  onClick={stopGenerating}
                  className="m-2 p-2 rounded-xl bg-black text-white hover:bg-gray-800 transition-all"
                >
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className={cn(
                    "m-2 p-2 rounded-xl transition-all",
                    input.trim()
                      ? "bg-black text-white hover:bg-gray-800"
                      : "bg-black/5 text-gray-300 cursor-not-allowed"
                  )}
                >
                  <Send size={18} />
                </button>
              )}
            </div>
            <p className="text-[10px] text-center mt-3 text-gray-400">
              AM can make mistakes. Check important info.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
