import React, { useState, useCallback, useMemo } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Handle,
    Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    Zap,
    MessageSquare,
    UserPlus,
    Tag,
    ArrowRight,
    Trash2,
    Save,
    Plus,
    Play,
    Activity,
    Webhook
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';

// --- Custom Nodes ---

const TriggerNode = ({ data }) => {
    const Icon = data.icon || Zap;
    return (
        <div className="px-4 py-3 shadow-2xl rounded-2xl bg-[#121215] border-2 border-primary/50 min-w-[200px] group transition-all hover:border-primary">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-primary/10 ${data.color || 'text-primary'}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Trigger</p>
                    <p className="text-sm font-bold text-foreground">{data.label}</p>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary border-2 border-[#121215]" />
        </div>
    );
};

const ActionNode = ({ data, id }) => {
    const Icon = data.icon || Activity;
    return (
        <div className="px-4 py-3 shadow-2xl rounded-2xl bg-[#0a0a0c] border-2 border-border/50 min-w-[220px] group transition-all hover:border-primary/50">
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-border border-2 border-[#121215]" />
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-secondary/50 text-foreground`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Action</p>
                        <p className="text-sm font-bold text-foreground">{data.label}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => data.onDelete(id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
            </div>

            {data.type === 'send_template' && (
                <div className="mt-2 space-y-2 pt-2 border-t border-border/10">
                    <Label className="text-[9px] font-black uppercase tracking-tight opacity-40">Template Name</Label>
                    <Input
                        className="h-7 text-[10px] bg-secondary/20 border-border/20"
                        placeholder="e.g. welcome_promo"
                        value={data.value || ''}
                        onChange={(e) => data.onChange(id, e.target.value)}
                    />
                </div>
            )}

            {data.type === 'add_tag' && (
                <div className="mt-2 space-y-2 pt-2 border-t border-border/10">
                    <Label className="text-[9px] font-black uppercase tracking-tight opacity-40">Tag to Add</Label>
                    <Input
                        className="h-7 text-[10px] bg-secondary/20 border-border/20"
                        placeholder="e.g. interested"
                        value={data.value || ''}
                        onChange={(e) => data.onChange(id, e.target.value)}
                    />
                </div>
            )}

            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary border-2 border-[#121215]" />
        </div>
    );
};

const nodeTypes = {
    trigger: TriggerNode,
    action: ActionNode,
};

// --- Main Builder ---

export default function AutomationFlowBuilder({ onSave, initialData, onCancel }) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialData?.nodes || [
        {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 250, y: 50 },
            data: {
                label: 'Keyword Match',
                type: 'keyword_match',
                icon: MessageSquare,
                color: 'text-blue-400'
            },
            draggable: false
        },
    ]);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialData?.edges || []);
    const [workflowName, setWorkflowName] = useState(initialData?.name || 'New Workflow');

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#00a884', strokeWidth: 3 } }, eds)),
        [setEdges]
    );

    const deleteNode = useCallback((id) => {
        setNodes((nds) => nds.filter((node) => node.id !== id));
        setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    }, [setNodes, setEdges]);

    const updateNodeValue = useCallback((id, value) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === id) {
                return { ...node, data: { ...node.data, value } };
            }
            return node;
        }));
    }, [setNodes]);

    const addNode = (type) => {
        const id = `action-${Date.now()}`;
        let label = 'Action';
        let icon = Activity;

        if (type === 'send_template') { label = 'Send Template'; icon = MessageSquare; }
        if (type === 'add_tag') { label = 'Add Tag'; icon = Tag; }
        if (type === 'webhook') { label = 'Webhook'; icon = Webhook; }

        const newNode = {
            id,
            type: 'action',
            position: { x: 250, y: nodes[nodes.length - 1].position.y + 150 },
            data: {
                label,
                type,
                icon,
                onDelete: deleteNode,
                onChange: updateNodeValue,
                value: ''
            },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const handleSave = () => {
        const flowData = { nodes, edges };
        // Flatten for simple backend compatibility
        const trigger = nodes.find(n => n.type === 'trigger')?.data.type || 'keyword_match';
        const actions = nodes.filter(n => n.type === 'action').map(n => ({
            type: n.data.type,
            value: n.data.value
        }));

        onSave({
            name: workflowName,
            trigger,
            actions,
            flow_data: flowData
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#0a0a0c] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Builder Header */}
            <div className="h-16 border-b border-border bg-[#121215] flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <input
                            value={workflowName}
                            onChange={(e) => setWorkflowName(e.target.value)}
                            className="bg-transparent border-none text-sm font-black uppercase tracking-tight focus:outline-none focus:ring-0 w-64"
                            placeholder="Workflow Name..."
                        />
                        <p className="text-[10px] text-muted-foreground font-bold opacity-40">AUTOMATION FLOW BUILDER</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="ghost" className="h-9 px-6 font-bold text-xs uppercase" onClick={onCancel}>Exit</Button>
                    <Button className="h-9 px-8 bg-[#0b5c53] hover:bg-[#084a43] text-white font-black text-xs uppercase rounded-full shadow-lg shadow-primary/20" onClick={handleSave}>
                        <Save className="w-3.5 h-3.5 mr-2" /> Save Workflow
                    </Button>
                </div>
            </div>

            <div className="flex-1 relative flex">
                {/* Sidebar Controls */}
                <div className="w-72 border-r border-border bg-[#121215] p-6 flex flex-col gap-6 overflow-y-auto">
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Add Actions</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <Button
                                variant="outline"
                                className="justify-start h-12 border-border/50 hover:border-primary/50 bg-secondary/10 hover:bg-secondary/20"
                                onClick={() => addNode('send_template')}
                            >
                                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 mr-3">
                                    <MessageSquare className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold">Send Template</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="justify-start h-12 border-border/50 hover:border-primary/50 bg-secondary/10 hover:bg-secondary/20"
                                onClick={() => addNode('add_tag')}
                            >
                                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 mr-3">
                                    <Tag className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold">Add Tag</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="justify-start h-12 border-border/50 hover:border-primary/50 bg-secondary/10 hover:bg-secondary/20"
                                onClick={() => addNode('webhook')}
                            >
                                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 mr-3">
                                    <Webhook className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold">Webhook</span>
                            </Button>
                        </div>
                    </div>

                    <div className="mt-auto p-4 rounded-2xl bg-primary/5 border border-primary/10">
                        <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <Activity className="w-3 h-3" /> Flow Logic
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Drag actions onto the canvas and connect them to build your sequence. Each node will execute in order.
                        </p>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 bg-[#0d1117] pattern-grid">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-[#0d1117]"
                    >
                        <Background color="#1f1f23" gap={20} />
                        <Controls className="bg-[#121215] border-border" />
                        <MiniMap
                            style={{ backgroundColor: '#121215', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                            maskColor="rgba(0,0,0,0.5)"
                            nodeColor="#00a884"
                        />
                    </ReactFlow>
                </div>
            </div>

            <style>{`
        .pattern-grid {
          background-image: radial-gradient(#1f1f23 1px, transparent 0);
          background-size: 20px 20px;
        }
        .react-flow__handle {
          width: 8px !important;
          height: 8px !important;
        }
        .react-flow__edge-path {
          stroke: #00a884;
          stroke-width: 3;
        }
        .react-flow__controls-button {
          background: #121215 !important;
          border-bottom: 1px solid rgba(255,255,255,0.1) !important;
          fill: #8696a0 !important;
        }
        .react-flow__controls-button:hover {
          background: #1f1f23 !important;
        }
      `}</style>
        </div>
    );
}
