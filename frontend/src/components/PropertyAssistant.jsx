import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, Sparkles, User, Maximize2, Minimize2 } from 'lucide-react';

export default function PropertyAssistant({ analysisResult, address, isAgentMode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Hi! I'm your Parcel Intelligence Assistant. How can I help you analyze ${address || 'this property'}?`,
            suggestions: ["What is the Deal Health Score?", "Tell me about climate risks", "What's the financial impact?"]
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    const handleSendMessage = async (text) => {
        if (!text.trim()) return;

        const userMessage = { role: 'user', content: text };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            // Strip out suggestions from history to save tokens
            const history = messages.map(({ role, content }) => ({ role, content }));
            
            // --- Reconstruct Payload Internally ---
            const { risk, ai_summary, derived_factors, coverage } = analysisResult || {};
            
            const rawRiskScore = risk?.overall_score ?? 50;
            const dealHealthScore = Math.max(0, Math.min(100, Math.round(100 - rawRiskScore)));
            
            const factors = risk?.factors || {};
            
            const titleRisk = { score: factors.ownership?.score ?? 0, flags: [] };
            if (factors.ownership?.score > 50) titleRisk.flags.push("High ownership volatility");
            if (derived_factors?.easement_encroachment > 0.05) titleRisk.flags.push(`Easement encroachment (${Math.round(derived_factors.easement_encroachment * 100)}%)`);

            const structuralRisk = { score: factors.coverage?.score ?? 0, flags: [] };
            if (derived_factors?.property_age > 30) structuralRisk.flags.push(`Aging property (${derived_factors.property_age} yrs)`);
            if (coverage?.expansion_risk === 'HIGH') structuralRisk.flags.push("High lot coverage / Max zoned");

            const climateRiskScore = Math.max(factors.flood?.score ?? 0, factors.wildfire?.score ?? 0, factors.earthquake?.score ?? 0);
            const climateRisk = { score: climateRiskScore, flags: [] };
            if (factors.flood?.score > 50) climateRisk.flags.push("FEMA Flood Zone Risk");
            if (factors.wildfire?.score > 50) climateRisk.flags.push("Historical Wildfire Area");
            if (factors.earthquake?.score > 50) climateRisk.flags.push("Seismic Fault Proximity");

            const insuranceImpact = {
                score: Math.min(100, climateRiskScore * 1.2),
                flags: ai_summary?.financial_impacts?.map(f => `${f.category}: ${f.estimate}`) || ["Review required"]
            };

            const timeline = [];
            const currentYear = new Date().getFullYear();
            if (derived_factors?.property_age) timeline.push({ year: currentYear - derived_factors.property_age, event: "Structure Built", riskChange: 0 });
            if (factors.ownership?.description && factors.ownership.description.includes("transfer")) timeline.push({ year: currentYear - 2, event: "Recent Ownership Transfer", riskChange: 5 });
            timeline.push({ year: currentYear, event: "Parcel Intelligence Risk Analysis", riskChange: -10 });

            const hashString = (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
                return Math.abs(hash);
            };
            const seededRandom = (seed) => {
                const x = Math.sin(seed++) * 10000;
                return x - Math.floor(x);
            };

            const addressHash = address ? hashString(address) : 12345;
            const buildingSqft = coverage?.building_area_sqft || 2400;
            const baseValue = buildingSqft * (400 + (seededRandom(addressHash) * 300));
            const priceAdjustmentPct = (dealHealthScore - 80) * 0.2; 
            const estimatedValue = baseValue * (1 + (priceAdjustmentPct / 100));
            const priceImpactDollar = estimatedValue - baseValue;
            const baseDays = 20 + (seededRandom(addressHash + 1) * 20);
            const estDaysOnMarket = Math.round(baseDays + ((100 - dealHealthScore) * 0.5));

            const zoningHighlights = [
                { label: "Estimated Area", value: `${coverage?.building_area_sqft || 'N/A'} sqft` },
                { label: "Lot Coverage", value: `${((coverage?.lot_coverage_pct || 0) * 100).toFixed(1)}%` },
            ];
            if (coverage?.zoning_max_coverage) zoningHighlights.push({ label: "Zoning Max", value: `${(coverage.zoning_max_coverage * 100).toFixed(1)}%`, isWarning: coverage.lot_coverage_pct > coverage.zoning_max_coverage * 0.9 });
            zoningHighlights.push({ label: "Easement Issue", value: derived_factors?.easement_encroachment > 0.05 ? "Detected" : "Clear", isWarning: derived_factors?.easement_encroachment > 0.05 });

            const assistantPayload = {
              property: {
                name: address || "Target Property",
                address: address || "Unknown",
                dealHealthScore: dealHealthScore,
                riskSummary: { titleRisk, structuralRisk, climateRisk, insuranceImpact },
                timeline: timeline,
                titleZoningHighlights: zoningHighlights,
                financialData: {
                  estimatedValue: estimatedValue,
                  priceAdjustmentImpact: priceImpactDollar,
                  annualInsurancePremium: Array.from({length: 20}, (_, i) => 1000 + (seededRandom(addressHash + i * 10 + 2) * 3000))[0],
                  resaleLiquidityDays: estDaysOnMarket
                }
              }
            };

            const reqBody = {
                prompt: text,
                mode: isAgentMode ? 'agent' : 'regular',
                propertyData: assistantPayload,
                history: history
            };

            const response = await fetch('http://localhost:5001/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqBody)
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.response,
                suggestions: data.suggestions || []
            }]);

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "I'm having trouble connecting to the Parcel Intelligence engine right now. Please try again later.",
                suggestions: []
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${isOpen ? (isExpanded ? 'w-[600px] h-[80vh]' : 'w-[380px] h-[500px]') : 'w-auto h-auto'}`}>
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsOpen(true)}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-black shadow-glow"
                    >
                        <MessageSquare size={24} className="fill-current" />
                        {/* Notification dot */}
                        <span className="absolute right-3 top-3 flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-white/5 bg-black/40 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                                    <Sparkles size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-text-primary">Parcel Intelligence</h3>
                                    <p className="text-[10px] text-text-secondary">
                                        {isAgentMode ? '⚡ Agent PRO Mode Active' : 'Property Advisor'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-text-secondary">
                                <button 
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="rounded p-1.5 transition hover:bg-white/10 hover:text-white"
                                >
                                    {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="rounded p-1.5 transition hover:bg-white/10 hover:text-white"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Chat History */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex max-w-[85%] gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        
                                        {/* Avatar */}
                                        <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-primary text-black'}`}>
                                            {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                        </div>

                                        {/* Bubble */}
                                        <div className="flex flex-col gap-2">
                                            <div className={`rounded-xl p-3 text-sm leading-relaxed ${
                                                msg.role === 'user' 
                                                ? 'bg-indigo-500 text-white rounded-tr-sm' 
                                                : 'bg-white/5 text-text-primary rounded-tl-sm border border-white/5'
                                            }`}>
                                                {msg.content}
                                            </div>

                                            {/* Suggestions */}
                                            {msg.suggestions && msg.suggestions.length > 0 && idx === messages.length - 1 && (
                                                <div className="mt-1 flex flex-wrap gap-2">
                                                    {msg.suggestions.map((suggestion, sIdx) => (
                                                        <button 
                                                            key={sIdx}
                                                            onClick={() => handleSendMessage(suggestion)}
                                                            className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary transition hover:bg-primary/10 hover:border-primary/40 text-left"
                                                        >
                                                            {suggestion}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="flex gap-2">
                                        <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-black">
                                            <Bot size={12} />
                                        </div>
                                        <div className="flex h-10 w-16 items-center justify-center gap-1 rounded-xl rounded-tl-sm border border-white/5 bg-white/5">
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary" style={{ animationDelay: '0ms' }} />
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary" style={{ animationDelay: '150ms' }} />
                                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-secondary" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="border-t border-white/5 bg-black/20 p-3">
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }}
                                className="flex items-center gap-2"
                            >
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Ask anything about this property..."
                                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    disabled={isLoading}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim() || isLoading}
                                    className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-primary text-black transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
