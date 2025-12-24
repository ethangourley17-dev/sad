
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Modality } from '@google/genai';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
    Campaign, 
    Lead, 
    VoiceName, 
    CallStatus,
    ViewType,
    Funnel
} from './types';
import { generateId } from './utils';
import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import { 
    ThinkingIcon, 
    CodeIcon, 
    SparklesIcon, 
    ArrowUpIcon, 
    GridIcon 
} from './components/Icons';

const PREBUILT_VOICES: VoiceName[] = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function App() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
    const [currentView, setCurrentView] = useState<ViewType>('Dashboard');
    const [isGenerating, setIsGenerating] = useState(false);
    const [simulationLog, setSimulationLog] = useState<{role: 'user' | 'ai', text: string}[]>([]);
    const [simInput, setSimInput] = useState('');
    
    // Funnel Generation State
    const [funnelNiche, setFunnelNiche] = useState('Stake Casino VIP Bonus');
    const [isGeneratingFunnel, setIsGeneratingFunnel] = useState(false);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const activeCampaign = campaigns.find(c => c.id === activeCampaignId);

    useEffect(() => {
        if (campaigns.length === 0) {
            const defaultCampaign: Campaign = {
                id: generateId(),
                name: "Stake Casino VIP Outreach",
                model: "gemini-3-pro-preview",
                systemInstruction: "You are an elite sales concierge for Stake.com. You are calling high-potential leads who just signed up. Your tone is exclusive, knowledgeable, and helpful. You want to get them to make their first deposit using code NEXUS.",
                objectionHandling: "If they say 'already have an account', ask if they have a dedicated host. If they mention bonuses, explain our VIP rakeback system.",
                script: "Hey [Lead Name], this is your personal account manager from the Stake VIP desk. I saw you just landed on our promo page. Ready to claim that 200% match?",
                voice: { voiceName: 'Zephyr', speed: 1.05, pitch: 1.0 },
                leads: [
                    { id: '1', name: 'James Miller', phone: '555-0102', status: 'Pending', notes: '', source: 'Stake High-Roller Funnel' },
                    { id: '2', name: 'Sarah Sterling', phone: '555-0394', status: 'In Progress', notes: '', source: 'Manual' }
                ],
                funnels: [],
                stats: { totalCalls: 154, appointments: 28, conversion: 18.2 }
            };
            setCampaigns([defaultCampaign]);
            setActiveCampaignId(defaultCampaign.id);
        }
    }, []);

    const updateActiveCampaign = (updates: Partial<Campaign>) => {
        if (!activeCampaignId) return;
        setCampaigns(prev => prev.map(c => c.id === activeCampaignId ? { ...c, ...updates } : c));
    };

    const playTTS = async (text: string) => {
        if (!activeCampaign) return;
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: `Respond naturally: ${text}` }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: activeCampaign.voice.voiceName } },
                    },
                },
            });
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
                const ctx = audioCtxRef.current;
                const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.start();
            }
        } catch (e) { console.error("TTS Error:", e); }
    };

    const handleGenerateFunnel = async () => {
        if (!activeCampaign) return;
        setIsGeneratingFunnel(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Generate a high-converting Stake Casino affiliate landing page for: ${funnelNiche}. 
            Optimize for AI search (GPT magnetism) by using structured data and clear semantic definitions.
            Include a form with Name and Phone. 
            Use dark UI theme with #00ffff accents. Output valid standalone HTML/CSS.`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
            });

            const newFunnel: Funnel = {
                id: generateId(),
                name: `${funnelNiche} Magnet`,
                niche: funnelNiche,
                html: response.text || "<html><body>Error generating funnel</body></html>",
                magnetismScore: 85 + Math.floor(Math.random() * 15),
                targetKeywords: ['Stake Promo', 'VIP Casino Bonus', 'High Stakes Rakeback']
            };

            updateActiveCampaign({ funnels: [...activeCampaign.funnels, newFunnel] });
        } catch (e) { console.error(e); } finally { setIsGeneratingFunnel(false); }
    };

    const handleSimulationSend = async () => {
        if (!simInput.trim() || !activeCampaign) return;
        const userText = simInput;
        setSimulationLog(prev => [...prev, { role: 'user', text: userText }]);
        setSimInput('');
        setIsGenerating(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: activeCampaign.model,
                contents: [{ parts: [{ text: userText }] }],
                config: { systemInstruction: activeCampaign.systemInstruction }
            });
            const aiResponse = response.text || "I'll have to check on that.";
            setSimulationLog(prev => [...prev, { role: 'ai', text: aiResponse }]);
            await playTTS(aiResponse);
        } catch (e) { console.error(e); } finally { setIsGenerating(false); }
    };

    const simulateFunnelLead = (funnel: Funnel) => {
        if (!activeCampaign) return;
        const newLead: Lead = {
            id: generateId(),
            name: "John Doe (Simulated)",
            phone: "+1 555-1234",
            status: "Pending",
            notes: "Joined via " + funnel.name,
            source: funnel.name
        };
        updateActiveCampaign({ leads: [...activeCampaign.leads, newLead] });
        alert("Lead simulated! Check Lead Ops.");
    };

    const renderDashboard = () => (
        <div className="dashboard-grid animate-in">
            <section className="config-panel glass">
                <div className="panel-header"><h2>Intelligence Engine</h2><span className="badge">Config</span></div>
                <div className="field">
                    <label>System Instructions</label>
                    <textarea value={activeCampaign?.systemInstruction} onChange={e => updateActiveCampaign({systemInstruction: e.target.value})} />
                </div>
                <div className="field">
                    <label>Objection Handling</label>
                    <textarea value={activeCampaign?.objectionHandling} onChange={e => updateActiveCampaign({objectionHandling: e.target.value})} />
                </div>
                <div className="settings-row">
                    <div className="field">
                        <label>Voice Profile</label>
                        <select value={activeCampaign?.voice.voiceName} onChange={e => updateActiveCampaign({voice: {...activeCampaign!.voice, voiceName: e.target.value as VoiceName}})}>
                            {PREBUILT_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className="field">
                        <label>Speed: {activeCampaign?.voice.speed}x</label>
                        <input type="range" min="0.5" max="2.0" step="0.1" value={activeCampaign?.voice.speed} onChange={e => updateActiveCampaign({voice: {...activeCampaign!.voice, speed: parseFloat(e.target.value)}})} />
                    </div>
                </div>
            </section>

            <section className="simulator-panel glass">
                <div className="panel-header"><h2>Live Terminal</h2></div>
                <div className="simulator-display">
                    {simulationLog.map((log, i) => (
                        <div key={i} className={`msg ${log.role}`}>
                            <div className="msg-tag">{log.role.toUpperCase()}</div>
                            <div className="msg-content">{log.text}</div>
                        </div>
                    ))}
                    {isGenerating && <div className="msg ai thinking"><ThinkingIcon /> AI Thinking...</div>}
                </div>
                <div className="simulator-input">
                    <input type="text" value={simInput} onChange={e => setSimInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSimulationSend()} placeholder="Simulate lead response..." />
                    <button onClick={handleSimulationSend}><ArrowUpIcon /></button>
                </div>
            </section>
        </div>
    );

    const renderFunnels = () => (
        <div className="funnel-factory animate-in">
            <div className="factory-header glass">
                <div className="field flex-grow">
                    <label>Describe Your Stake Funnel Target</label>
                    <input type="text" value={funnelNiche} onChange={e => setFunnelNiche(e.target.value)} placeholder="e.g. Stake Casino $1000 Welcome Pack..." />
                </div>
                <button className="primary-btn-glow" onClick={handleGenerateFunnel} disabled={isGeneratingFunnel}>
                    {isGeneratingFunnel ? <ThinkingIcon /> : <SparklesIcon />} Generate Magnetized Page
                </button>
            </div>
            <div className="funnel-grid">
                {activeCampaign?.funnels.map(funnel => (
                    <div key={funnel.id} className="funnel-card-wrapper">
                        <div className="funnel-stats-overlay">
                            <span className="mag-score">AI Magnetism: {funnel.magnetismScore}%</span>
                            <button className="sim-lead-btn" onClick={() => simulateFunnelLead(funnel)}>Simulate Conversion</button>
                        </div>
                        <ArtifactCard 
                            artifact={{ id: funnel.id, styleName: funnel.name, status: 'complete', html: funnel.html }}
                            isFocused={false}
                            onClick={() => {}}
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    const renderLeads = () => (
        <div className="leads-panel glass full-width animate-in">
            <div className="panel-header"><h2>Lead Intelligence Queue</h2></div>
            <table className="leads-table">
                <thead><tr><th>Name</th><th>Communication</th><th>Origin</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                    {activeCampaign?.leads.map(l => (
                        <tr key={l.id}>
                            <td className="lead-name-cell"><div className="avatar">{l.name.charAt(0)}</div>{l.name}</td>
                            <td>{l.phone}</td>
                            <td><span className="source-tag">{l.source}</span></td>
                            <td><span className={`status-badge ${l.status.toLowerCase().replace(' ', '-')}`}>{l.status}</span></td>
                            <td><button className="call-btn-action" onClick={() => { setCurrentView('Dashboard'); setSimulationLog([{role: 'ai', text: activeCampaign.script.replace('[Lead Name]', l.name)}]); playTTS(activeCampaign.script.replace('[Lead Name]', l.name)); }}>Call Now</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderAnalytics = () => (
        <div className="analytics-view animate-in">
            <div className="stats-row">
                <div className="stat-card-large glass">
                    <label>Total Conversions</label>
                    <div className="value glow-text-cyan">{activeCampaign?.stats.appointments}</div>
                    <div className="stat-footer">+12% from last week</div>
                </div>
                <div className="stat-card-large glass">
                    <label>AI Magnetism Avg</label>
                    <div className="value glow-text-gold">94.2%</div>
                    <div className="stat-footer">Top 1% of GPT Results</div>
                </div>
                <div className="stat-card-large glass">
                    <label>Call Volume</label>
                    <div className="value">{activeCampaign?.stats.totalCalls}</div>
                    <div className="stat-footer">2.4 min avg duration</div>
                </div>
            </div>
            <div className="chart-area glass">
                <div className="panel-header"><h2>Performance Overview</h2></div>
                <div className="sim-chart">
                    <div className="bar" style={{ height: '40%' }}><span>Mon</span></div>
                    <div className="bar" style={{ height: '60%' }}><span>Tue</span></div>
                    <div className="bar" style={{ height: '55%' }}><span>Wed</span></div>
                    <div className="bar" style={{ height: '80%' }}><span>Thu</span></div>
                    <div className="bar active" style={{ height: '95%' }}><span>Fri</span></div>
                    <div className="bar" style={{ height: '70%' }}><span>Sat</span></div>
                    <div className="bar" style={{ height: '65%' }}><span>Sun</span></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="nexus-app">
            <DottedGlowBackground gap={24} color="rgba(0, 255, 255, 0.05)" glowColor="rgba(0, 255, 255, 0.2)" />
            
            <nav className="nexus-sidebar">
                <div className="nexus-logo"><SparklesIcon /><span>NEXUS AI</span></div>
                <div className="nav-items">
                    <button className={`nav-item ${currentView === 'Dashboard' ? 'active' : ''}`} onClick={() => setCurrentView('Dashboard')}><GridIcon /> Sales Engine</button>
                    <button className={`nav-item ${currentView === 'Funnels' ? 'active' : ''}`} onClick={() => setCurrentView('Funnels')}><CodeIcon /> Funnel Factory</button>
                    <button className={`nav-item ${currentView === 'Leads' ? 'active' : ''}`} onClick={() => setCurrentView('Leads')}><ThinkingIcon /> Lead Ops</button>
                    <button className={`nav-item ${currentView === 'Analytics' ? 'active' : ''}`} onClick={() => setCurrentView('Analytics')}><GridIcon /> Analytics</button>
                </div>
                <div className="sidebar-footer">
                    <div className="section-label">CAMPAIGN</div>
                    <div className="active-campaign-badge">{activeCampaign?.name}</div>
                </div>
            </nav>

            <main className="nexus-content">
                {currentView === 'Dashboard' && renderDashboard()}
                {currentView === 'Funnels' && renderFunnels()}
                {currentView === 'Leads' && renderLeads()}
                {currentView === 'Analytics' && renderAnalytics()}
            </main>
        </div>
    );
}

const rootElement = document.getElementById('root');
if (rootElement) ReactDOM.createRoot(rootElement).render(<App />);
