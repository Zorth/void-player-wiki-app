'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KNOWN_WORLDS } from '@/lib/constants';
import {
  Save,
  Eye,
  Edit3,
  Image as ImageIcon,
  Link as LinkIcon,
  Compass,
  User,
  Tag,
  AlertCircle,
  ArrowLeft,
  MapPin,
  Flag,
  Calendar,
  Layers,
  BookOpen,
  CheckCircle2,
  Lock,
  MoreHorizontal,
  Upload,
  FolderOpen,
  X,
  Search,
  Plus,
  Check,
  Sparkles,
  FilePenLine,
  List,
  Indent,
  Outdent,
  Table,
} from 'lucide-react';
import { marked } from 'marked';

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-xs text-obsidian-textFaint">Loading Editor...</div>}>
      <EditorContent />
    </Suspense>
  );
}

type ArticleType = 'location' | 'npc' | 'organization' | 'event' | 'species' | 'meta' | 'other' | 'session' | 'pc' | 'world';

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editSlug = searchParams.get('slug');

  const [title, setTitle] = useState('');
  const [articleType, setArticleType] = useState<ArticleType>('location');
  const [isSettlement, setIsSettlement] = useState(false);
  const [otherTag, setOtherTag] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [image, setImage] = useState('');
  const [guildCharacterId, setGuildCharacterId] = useState<string | undefined>(undefined);
  const [selectedWorlds, setSelectedWorlds] = useState<string[]>([]);
  const [extraTagsStr, setExtraTagsStr] = useState('');
  const [content, setContent] = useState('');
  const [existingFilePath, setExistingFilePath] = useState<string | undefined>(undefined);

  // Session Report Structured Fields
  const [sessionAbstract, setSessionAbstract] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [preservedPcSection, setPreservedPcSection] = useState('');

  const [isExistingSession, setIsExistingSession] = useState(false);
  const [isExistingCharacter, setIsExistingCharacter] = useState(false);
  const [existingMetadata, setExistingMetadata] = useState<any>(null);

  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  // Character Image Gallery & Upload Modal
  const [showImageBrowser, setShowImageBrowser] = useState(false);
  const [availableImages, setAvailableImages] = useState<Array<{ filename: string; url: string; size: number }>>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageSearch, setImageSearch] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Vault Existing Tags for Fuzzy Autocomplete
  const [allExistingTags, setAllExistingTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [otherTagSearch, setOtherTagSearch] = useState('');
  const [showOtherTagDropdown, setShowOtherTagDropdown] = useState(false);

  // Sub-tags Autocomplete State
  const [subTagInput, setSubTagInput] = useState('');
  const [showSubTagDropdown, setShowSubTagDropdown] = useState(false);

  // Wikilink Search & Insert Modal State
  const [showWikilinkModal, setShowWikilinkModal] = useState(false);
  const [wikilinkSearch, setWikilinkSearch] = useState('');
  const [wikilinkCustomAlias, setWikilinkCustomAlias] = useState('');
  const [wikilinkResults, setWikilinkResults] = useState<Array<{ slug: string; title: string; category: string; worlds: string[]; tags: string[]; abstract?: string }>>([]);
  const [loadingWikilinks, setLoadingWikilinks] = useState(false);
  const [savedSelection, setSavedSelection] = useState<{ start: number; end: number; selectedText: string }>({ start: 0, end: 0, selectedText: '' });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abstractTextareaRef = useRef<HTMLTextAreaElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const activeFieldRef = useRef<'content' | 'abstract' | 'notes'>('content');

  useEffect(() => {
    // Check user auth & edit permissions
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated || !data.user.canEdit) {
          setError('You do not have permission to edit or create articles. Contact an administrator.');
        } else {
          setUser(data.user);
        }
      });

    // If editing existing note
    if (editSlug) {
      fetch(`/api/notes/get?slug=${encodeURIComponent(editSlug)}`)
        .then(res => res.json())
        .then(data => {
          if (data.note) {
            const n = data.note;
            setTitle(n.title);
            setContent(n.rawContent || '');
            setExistingFilePath(n.filePath);
            setSelectedWorlds(n.worlds || []);
            setExistingMetadata(n);
            if (n.image) setImage(n.image);
            if (n.guildCharacterId) setGuildCharacterId(n.guildCharacterId);

            if (n.category === 'session-report' || n.tags.includes('session')) {
              setArticleType('session');
              setIsExistingSession(true);
              if (n.date) setSessionDate(n.date);

              // Parse out Abstract, PC section, and Notes
              const raw = n.rawContent || '';
              const absMatch = raw.match(/>\s*\[!abstract\][^\n]*\n((?:[ \t]*>.*(?:\n|$))*)/i);
              let abs = '';
              if (absMatch) {
                abs = absMatch[1].replace(/^[ \t]*>[ \t]?/gm, '').trim();
              } else if (n.abstract) {
                abs = n.abstract.trim();
              }
              setSessionAbstract(abs);

              // Extract and preserve PC section so it's not destroyed upon re-saving
              const pcMatch = raw.match(/##\s+(?:\[\[pc\|Player Character\]\]s|Player Characters)[\s\S]*?(?=\n##|$)/i);
              if (pcMatch) {
                setPreservedPcSection(pcMatch[0].trim());
              }

              // Extract Notes: strip Title, abstract, and PC section
              let remainingNotes = raw;
              remainingNotes = remainingNotes.replace(/^#\s+[^\n]*\n*/, '');
              remainingNotes = remainingNotes.replace(/>\s*\[!abstract\][^\n]*\n((?:[ \t]*>.*(?:\n|$))*)/gi, '');
              remainingNotes = remainingNotes.replace(/##\s+(?:\[\[pc\|Player Character\]\]s|Player Characters)[\s\S]*?(?=\n##|$)/gi, '');
              remainingNotes = remainingNotes.replace(/##\s*Notes\s*\n*/i, '');
              setSessionNotes(remainingNotes.trim());
            } else if (n.category === 'character' || n.tags.includes('pc')) {
              setArticleType('pc');
              setIsExistingCharacter(true);
              // Strip redundant character abstract block if present
              const cleanCharContent = (n.rawContent || '').replace(/>\s*\[!abstract\][^\n]*\n((?:[ \t]*>.*(?:\n|$))*)/gi, '').trim();
              setContent(cleanCharContent);
            } else if (n.tags.includes('world')) {
              setArticleType('world');
            } else if (n.tags.includes('location/settlement')) {
              setArticleType('location');
              setIsSettlement(true);
            } else if (n.tags.includes('location')) {
              setArticleType('location');
              setIsSettlement(false);
            } else if (n.tags.includes('npc')) {
              setArticleType('npc');
            } else if (n.tags.includes('organization')) {
              setArticleType('organization');
            } else if (n.tags.includes('event')) {
              setArticleType('event');
            } else if (n.tags.includes('species')) {
              setArticleType('species');
            } else if (n.category === 'guide' || n.tags.includes('meta')) {
              setArticleType('meta');
            } else if (n.tags.length > 0) {
              setArticleType('other');
              setOtherTag(n.tags[0]);
            }

            // Filter out primary tag from extra tags
            const primaryTags = ['location', 'location/settlement', 'npc', 'organization', 'event', 'species', 'meta', 'session', 'pc', 'world'];
            const extras = (n.tags || []).filter((t: string) => !primaryTags.includes(t) && !t.startsWith('pc/') && (n.tags.length === 0 || t !== n.tags[0] || primaryTags.some(pt => n.tags.includes(pt))));
            setExtraTagsStr(extras.join(', '));
          }
        })
        .catch(() => {});
    } else {
      const qCat = searchParams.get('category');
      const qTitle = searchParams.get('title');
      const qGuildCharId = searchParams.get('guildCharacterId');
      if (qTitle) setTitle(qTitle);
      if (qGuildCharId) setGuildCharacterId(qGuildCharId);
      if (qCat === 'character' || qCat === 'pc') {
        setArticleType('pc');
        setIsExistingCharacter(true);
      } else if (qCat === 'session-report' || qCat === 'session') {
        setArticleType('session');
        setIsExistingSession(true);
      }
    }

    // Fetch existing vault tags for autocomplete
    fetch('/api/tags')
      .then(res => res.json())
      .then(data => {
        if (data.tags) {
          setAllExistingTags(data.tags);
        }
      })
      .catch(() => {});
  }, [editSlug, searchParams]);

  const toggleWorld = (w: string) => {
    setSelectedWorlds(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]
    );
  };

  const getActiveTextarea = (): HTMLTextAreaElement | null => {
    if (articleType === 'session') {
      if (activeFieldRef.current === 'abstract') return abstractTextareaRef.current;
      return notesTextareaRef.current || abstractTextareaRef.current;
    }
    return textareaRef.current;
  };

  const insertText = (before: string, after: string = '') => {
    const ta = getActiveTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);
    const replacement = before + selected + after;
    const newContent = ta.value.substring(0, start) + replacement + ta.value.substring(end);

    if (articleType === 'session') {
      if (activeFieldRef.current === 'abstract') {
        setSessionAbstract(newContent);
      } else {
        setSessionNotes(newContent);
      }
    } else {
      setContent(newContent);
    }

    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const updateActiveContent = (newContent: string) => {
    if (articleType === 'session') {
      if (activeFieldRef.current === 'abstract') {
        setSessionAbstract(newContent);
      } else {
        setSessionNotes(newContent);
      }
    } else {
      setContent(newContent);
    }
  };

  // Insert or toggle unnumbered list on current line(s)
  const insertUnnumberedList = () => {
    const ta = getActiveTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;

    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = val.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = val.length;

    const block = val.substring(lineStart, lineEnd);
    const lines = block.split('\n');

    // Check if all non-empty lines already have list markers
    const allList = lines.every(l => !l.trim() || /^\s*[-*]\s+/.test(l));

    const newLines = lines.map(l => {
      if (!l.trim()) return l;
      if (allList) {
        // Toggle off list
        return l.replace(/^(\s*)[-*]\s+/, '$1');
      } else {
        // Add list if not present
        if (/^\s*[-*]\s+/.test(l)) return l;
        const indentMatch = l.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        return `${indent}- ${l.substring(indent.length)}`;
      }
    });

    const replaced = newLines.join('\n');
    const newContent = val.substring(0, lineStart) + replaced + val.substring(lineEnd);
    updateActiveContent(newContent);

    setTimeout(() => {
      ta.focus();
      const lengthDiff = replaced.length - block.length;
      ta.setSelectionRange(lineStart, end + lengthDiff);
    }, 0);
  };

  // Increase indentation of selected lines (or current line)
  const indentLines = () => {
    const ta = getActiveTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;

    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = val.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = val.length;

    const block = val.substring(lineStart, lineEnd);
    const lines = block.split('\n');
    const newLines = lines.map(l => (l.length > 0 ? `  ${l}` : l));
    const replaced = newLines.join('\n');
    const newContent = val.substring(0, lineStart) + replaced + val.substring(lineEnd);

    updateActiveContent(newContent);

    setTimeout(() => {
      ta.focus();
      const addedChars = newLines.length * 2;
      ta.setSelectionRange(start + 2, end + addedChars);
    }, 0);
  };

  // Decrease indentation of selected lines (or current line)
  const outdentLines = () => {
    const ta = getActiveTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;

    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = val.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = val.length;

    const block = val.substring(lineStart, lineEnd);
    const lines = block.split('\n');
    let removedCharsTotal = 0;
    let firstLineRemoved = 0;

    const newLines = lines.map((l, idx) => {
      let removed = 0;
      let newLine = l;
      if (newLine.startsWith('  ')) {
        newLine = newLine.substring(2);
        removed = 2;
      } else if (newLine.startsWith('\t') || newLine.startsWith(' ')) {
        newLine = newLine.substring(1);
        removed = 1;
      }
      if (idx === 0) firstLineRemoved = removed;
      removedCharsTotal += removed;
      return newLine;
    });

    const replaced = newLines.join('\n');
    const newContent = val.substring(0, lineStart) + replaced + val.substring(lineEnd);

    updateActiveContent(newContent);

    setTimeout(() => {
      ta.focus();
      const newStart = Math.max(lineStart, start - firstLineRemoved);
      const newEnd = Math.max(newStart, end - removedCharsTotal);
      ta.setSelectionRange(newStart, newEnd);
    }, 0);
  };

  // Insert a starter 3x3 Markdown Table
  const insertMarkdownTable = () => {
    const ta = getActiveTextarea();
    if (!ta) return;
    const starterTable =
      '\n| Header 1 | Header 2 | Header 3 |\n' +
      '| -------- | -------- | -------- |\n' +
      '| Cell 1   | Cell 2   | Cell 3   |\n' +
      '| Cell 4   | Cell 5   | Cell 6   |\n\n';
    insertText(starterTable);
  };

  // Helper to detect if a line is part of a markdown table
  const isTableLine = (line: string): boolean => {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length >= 2;
  };

  // Parse and reformat a markdown table block to cleanly auto-adjust column widths
  const formatTableBlock = (tableLines: string[]): string[] => {
    if (tableLines.length === 0) return tableLines;

    // Split each line into cells
    const parsedRows: string[][] = tableLines.map(line => {
      const trimmed = line.trim();
      // Remove leading and trailing pipes
      const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
      return inner.split('|').map(cell => cell.trim());
    });

    // Determine max columns
    const maxCols = Math.max(...parsedRows.map(r => r.length), 1);

    // Compute max width for each column
    const colWidths: number[] = [];
    for (let c = 0; c < maxCols; c++) {
      let maxW = 3; // minimum width
      parsedRows.forEach((row, rIdx) => {
        // Skip separator row when calculating text width
        if (rIdx === 1 && /^[-:\s]+$/.test(row[c] || '')) {
          return;
        }
        const cellLen = (row[c] || '').length;
        if (cellLen > maxW) maxW = cellLen;
      });
      colWidths.push(maxW);
    }

    // Reconstruct padded lines
    return parsedRows.map((row, rIdx) => {
      const isSep = rIdx === 1;
      const paddedCells = colWidths.map((w, c) => {
        const val = row[c] || '';
        if (isSep) {
          // Check alignment colons
          const leftColon = val.startsWith(':');
          const rightColon = val.endsWith(':');
          if (leftColon && rightColon) {
            return `:${'-'.repeat(Math.max(1, w - 2))}:`;
          } else if (leftColon) {
            return `:${'-'.repeat(Math.max(1, w - 1))}`;
          } else if (rightColon) {
            return `${'-'.repeat(Math.max(1, w - 1))}:`;
          }
          return '-'.repeat(w);
        }
        return val.padEnd(w, ' ');
      });
      return `| ${paddedCells.join(' | ')} |`;
    });
  };

  // Keyboard handler for Obsidian-like lists & tables:
  // - Enter on list: Continue list item at same indentation level; if item is empty, terminate list item
  // - Tab / Shift+Tab on list: Indent / outdent
  // - Tab on table cell: Jump to next cell, auto-format table, create new row if at bottom-right
  // - Shift+Tab on table cell: Jump to previous cell, auto-format table
  // - Enter on table cell: Jump to cell directly below in next row (or append new row if at bottom)
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const { selectionStart, selectionEnd, value } = ta;

    // Detect if current line is inside a markdown table
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    let lineEnd = value.indexOf('\n', selectionEnd);
    if (lineEnd === -1) lineEnd = value.length;
    const currentLine = value.substring(lineStart, lineEnd);

    if (isTableLine(currentLine)) {
      // Find full contiguous table bounds
      let tableBlockStart = lineStart;
      while (tableBlockStart > 0) {
        const prevLineStart = value.lastIndexOf('\n', tableBlockStart - 2) + 1;
        const prevLine = value.substring(prevLineStart, tableBlockStart - 1);
        if (isTableLine(prevLine)) {
          tableBlockStart = prevLineStart;
        } else {
          break;
        }
      }

      let tableBlockEnd = lineEnd;
      while (tableBlockEnd < value.length) {
        const nextLineEnd = value.indexOf('\n', tableBlockEnd + 1);
        const actualNextEnd = nextLineEnd === -1 ? value.length : nextLineEnd;
        const nextLine = value.substring(tableBlockEnd + 1, actualNextEnd);
        if (isTableLine(nextLine)) {
          tableBlockEnd = actualNextEnd;
        } else {
          break;
        }
      }

      const tableText = value.substring(tableBlockStart, tableBlockEnd);
      const originalLines = tableText.split('\n');

      // Table Navigation with Tab and Shift+Tab
      if (e.key === 'Tab') {
        e.preventDefault();
        const formattedLines = formatTableBlock(originalLines);
        const rowIdxInTable = value.substring(tableBlockStart, lineStart).split('\n').length - 1;

        // Count cell index on current line before selectionStart
        const textBeforeInLine = value.substring(lineStart, selectionStart);
        const pipesBefore = (textBeforeInLine.match(/\|/g) || []).length;
        const currentCellIdx = Math.max(0, pipesBefore - 1);

        let targetRow = rowIdxInTable;
        let targetCol = currentCellIdx;

        if (e.shiftKey) {
          // Move to previous cell
          if (targetCol > 0) {
            targetCol--;
          } else if (targetRow > 0) {
            targetRow--;
            if (targetRow === 1) targetRow = 0; // skip separator row
            const targetLineCols = (formattedLines[targetRow].match(/\|/g) || []).length - 1;
            targetCol = Math.max(0, targetLineCols - 1);
          }
        } else {
          // Move to next cell
          const curLineCols = (formattedLines[targetRow].match(/\|/g) || []).length - 1;
          if (targetCol + 1 < curLineCols) {
            targetCol++;
          } else {
            // Move to next row
            targetRow++;
            if (targetRow === 1) targetRow = 2; // skip separator row
            targetCol = 0;

            // If we reached past the end of the table, create a new row!
            if (targetRow >= formattedLines.length) {
              const numCols = (formattedLines[0].match(/\|/g) || []).length - 1;
              const emptyCells = Array(numCols).fill('   ');
              formattedLines.push(`| ${emptyCells.join(' | ')} |`);
            }
          }
        }

        const newTableText = formattedLines.join('\n');
        const newDocContent = value.substring(0, tableBlockStart) + newTableText + value.substring(tableBlockEnd);
        updateActiveContent(newDocContent);

        setTimeout(() => {
          ta.focus();
          // Calculate character position of target cell in formatted table
          let cursorOffset = tableBlockStart;
          for (let r = 0; r < targetRow; r++) {
            cursorOffset += formattedLines[r].length + 1; // +1 for \n
          }
          // Find the pipe for targetCol
          const targetLineStr = formattedLines[targetRow];
          let pipeCount = 0;
          let cellStartPos = 0;
          for (let i = 0; i < targetLineStr.length; i++) {
            if (targetLineStr[i] === '|') {
              pipeCount++;
              if (pipeCount === targetCol + 1) {
                cellStartPos = i + 2; // after "| "
                break;
              }
            }
          }
          const finalPos = cursorOffset + cellStartPos;
          ta.setSelectionRange(finalPos, finalPos);
        }, 0);
        return;
      }

      // Table Navigation with Enter: move to cell below or add new row
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const formattedLines = formatTableBlock(originalLines);
        const rowIdxInTable = value.substring(tableBlockStart, lineStart).split('\n').length - 1;

        const textBeforeInLine = value.substring(lineStart, selectionStart);
        const pipesBefore = (textBeforeInLine.match(/\|/g) || []).length;
        const currentCellIdx = Math.max(0, pipesBefore - 1);

        let targetRow = rowIdxInTable + 1;
        if (targetRow === 1) targetRow = 2; // skip separator row

        if (targetRow >= formattedLines.length) {
          const numCols = (formattedLines[0].match(/\|/g) || []).length - 1;
          const emptyCells = Array(numCols).fill('   ');
          formattedLines.push(`| ${emptyCells.join(' | ')} |`);
        }

        const newTableText = formattedLines.join('\n');
        const newDocContent = value.substring(0, tableBlockStart) + newTableText + value.substring(tableBlockEnd);
        updateActiveContent(newDocContent);

        setTimeout(() => {
          ta.focus();
          let cursorOffset = tableBlockStart;
          for (let r = 0; r < targetRow; r++) {
            cursorOffset += formattedLines[r].length + 1;
          }
          const targetLineStr = formattedLines[targetRow];
          let pipeCount = 0;
          let cellStartPos = 0;
          for (let i = 0; i < targetLineStr.length; i++) {
            if (targetLineStr[i] === '|') {
              pipeCount++;
              if (pipeCount === currentCellIdx + 1) {
                cellStartPos = i + 2;
                break;
              }
            }
          }
          const finalPos = cursorOffset + cellStartPos;
          ta.setSelectionRange(finalPos, finalPos);
        }, 0);
        return;
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        outdentLines();
      } else {
        // If there's a multi-line selection, indent all lines
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        let lineEnd = value.indexOf('\n', selectionEnd);
        if (lineEnd === -1) lineEnd = value.length;

        if (selectionStart !== selectionEnd && value.substring(lineStart, lineEnd).includes('\n')) {
          indentLines();
        } else {
          // If on a list item, indent the item
          const curLine = value.substring(lineStart, selectionStart);
          if (/^\s*[-*]\s+/.test(curLine)) {
            indentLines();
          } else {
            // Normal tab insertion (2 spaces)
            const newContent = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd);
            updateActiveContent(newContent);
            setTimeout(() => {
              ta.focus();
              ta.setSelectionRange(selectionStart + 2, selectionStart + 2);
            }, 0);
          }
        }
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineText = value.substring(lineStart, selectionStart);

      // Match bullet list item with indentation: e.g. "   - " or "  * "
      const listMatch = lineText.match(/^(\s*)([-*])\s+(.*)$/);

      if (listMatch) {
        e.preventDefault();
        const indent = listMatch[1];
        const bullet = listMatch[2];
        const itemContent = listMatch[3];

        // Case A: The list item is empty (user hit Enter twice to end list or decrease indentation)
        if (!itemContent.trim()) {
          if (indent.length >= 2) {
            // Outdent the bullet by 2 spaces
            const newIndent = indent.substring(2);
            const newLine = `${newIndent}${bullet} `;
            const newContent = value.substring(0, lineStart) + newLine + value.substring(selectionStart);
            updateActiveContent(newContent);
            setTimeout(() => {
              ta.focus();
              const newPos = lineStart + newLine.length;
              ta.setSelectionRange(newPos, newPos);
            }, 0);
          } else {
            // At root indent: clear bullet completely
            const newContent = value.substring(0, lineStart) + value.substring(selectionStart);
            updateActiveContent(newContent);
            setTimeout(() => {
              ta.focus();
              ta.setSelectionRange(lineStart, lineStart);
            }, 0);
          }
        } else {
          // Case B: Continue list item at same indentation level
          const nextBullet = `\n${indent}${bullet} `;
          const newContent = value.substring(0, selectionStart) + nextBullet + value.substring(selectionEnd);
          updateActiveContent(newContent);
          setTimeout(() => {
            ta.focus();
            const newPos = selectionStart + nextBullet.length;
            ta.setSelectionRange(newPos, newPos);
          }, 0);
        }
        return;
      }
    }

    if (e.key === 'Backspace' && selectionStart === selectionEnd) {
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineText = value.substring(lineStart, selectionStart);
      const emptyListMatch = lineText.match(/^(\s*)([-*])\s+$/);

      if (emptyListMatch) {
        e.preventDefault();
        const indent = emptyListMatch[1];
        const bullet = emptyListMatch[2];
        if (indent.length >= 2) {
          // Outdent bullet
          const newIndent = indent.substring(2);
          const newLine = `${newIndent}${bullet} `;
          const newContent = value.substring(0, lineStart) + newLine + value.substring(selectionStart);
          updateActiveContent(newContent);
          setTimeout(() => {
            ta.focus();
            const newPos = lineStart + newLine.length;
            ta.setSelectionRange(newPos, newPos);
          }, 0);
        } else {
          // Clear bullet
          const newContent = value.substring(0, lineStart) + value.substring(selectionStart);
          updateActiveContent(newContent);
          setTimeout(() => {
            ta.focus();
            ta.setSelectionRange(lineStart, lineStart);
          }, 0);
        }
      }
    }
  };

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        insertText(`\n![[${data.filename}]]\n`);
        if (articleType === 'pc' && !image) {
          setImage(data.filename);
        }
      } else {
        alert('Upload failed: ' + (await res.text()));
      }
    } catch (e: any) {
      alert('Upload error: ' + e.message);
    }
  };

  const loadAvailableImages = async () => {
    setLoadingImages(true);
    try {
      const res = await fetch('/api/attachments');
      if (res.ok) {
        const data = await res.json();
        setAvailableImages(data.images || []);
      }
    } catch (e) {
      console.error('Failed to load attachments:', e);
    } finally {
      setLoadingImages(false);
    }
  };

  const openImageBrowser = () => {
    setShowImageBrowser(true);
    loadAvailableImages();
  };

  const openWikilinkModal = () => {
    const ta = getActiveTextarea();
    let selected = '';
    let start = 0;
    let end = 0;
    if (ta) {
      start = ta.selectionStart;
      end = ta.selectionEnd;
      selected = ta.value.substring(start, end).trim();
    }
    setSavedSelection({ start, end, selectedText: selected });
    setWikilinkSearch(selected);
    setWikilinkCustomAlias(selected ? selected : '');
    setShowWikilinkModal(true);
    searchArticles(selected);
  };

  const searchArticles = async (query: string) => {
    setLoadingWikilinks(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setWikilinkResults(data.results || []);
      }
    } catch (e) {
      console.error('Failed to search articles:', e);
    } finally {
      setLoadingWikilinks(false);
    }
  };

  const insertWikilink = (title: string, alias?: string) => {
    const ta = getActiveTextarea();
    const cleanTitle = title.trim();
    const cleanAlias = (alias || wikilinkCustomAlias || '').trim();

    let linkText = `[[${cleanTitle}]]`;
    if (cleanAlias && cleanAlias.toLowerCase() !== cleanTitle.toLowerCase()) {
      linkText = `[[${cleanTitle}|${cleanAlias}]]`;
    }

    if (ta) {
      const { start, end } = savedSelection;
      const val = ta.value;
      const newContent = val.substring(0, start) + linkText + val.substring(end);
      if (articleType === 'session') {
        if (activeFieldRef.current === 'abstract') {
          setSessionAbstract(newContent);
        } else {
          setSessionNotes(newContent);
        }
      } else {
        setContent(newContent);
      }
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + linkText.length, start + linkText.length);
      }, 0);
    } else {
      insertText(linkText);
    }

    setShowWikilinkModal(false);
  };

  const handleCharacterImageUpload = async (file: File) => {
    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setImage(data.filename);
        setShowImageBrowser(false);
      } else {
        alert('Upload failed: ' + (await res.text()));
      }
    } catch (e: any) {
      alert('Upload error: ' + e.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError('');
    setSaving(true);

    // Determine tags
    const finalTags: string[] = [];
    if (articleType === 'location') {
      finalTags.push('location');
      if (isSettlement) finalTags.push('location/settlement');
    } else if (articleType === 'npc') {
      finalTags.push('npc');
    } else if (articleType === 'organization') {
      finalTags.push('organization');
    } else if (articleType === 'event') {
      finalTags.push('event');
    } else if (articleType === 'species') {
      finalTags.push('species');
    } else if (articleType === 'meta') {
      // Guide/rules articles are classified by folder (_META) and category ('guide'), not #meta tag
    } else if (articleType === 'other') {
      if (otherTag.trim()) {
        const cleanTag = otherTag.replace(/^#/, '').toLowerCase().trim();
        if (cleanTag) finalTags.push(cleanTag);
      }
    } else if (articleType === 'session') {
      finalTags.push('session');
    } else if (articleType === 'pc') {
      finalTags.push('pc');
      if (existingMetadata?.rank) {
        finalTags.push(`pc/${existingMetadata.rank}`);
      }
    } else if (articleType === 'world') {
      finalTags.push('world');
    }

    // Add extra tags
    if (extraTagsStr.trim()) {
      const extras = extraTagsStr.split(',').map(t => t.replace(/^#/, '').toLowerCase().trim()).filter(Boolean);
      finalTags.push(...extras);
    }

    // Determine category
    let category = 'world-note';
    if (articleType === 'meta') category = 'guide';
    else if (articleType === 'session') category = 'session-report';
    else if (articleType === 'pc') category = 'character';

    // Determine content: for session reports, assemble abstract + preserved PC section + notes
    let finalContent = content;
    if (articleType === 'session') {
      const parts: string[] = [];
      parts.push(`# ${title.trim()}\n`);

      // Abstract callout
      parts.push(`> [!abstract]`);
      if (sessionAbstract.trim()) {
        const absLines = sessionAbstract.trim().split('\n').map(l => `> ${l}`).join('\n');
        parts.push(absLines);
      } else {
        parts.push(`> `);
      }
      parts.push('');

      // Preserved PC section (if exists)
      if (preservedPcSection.trim()) {
        parts.push(preservedPcSection.trim());
        parts.push('');
      }

      // Notes section
      parts.push('## Notes');
      if (sessionNotes.trim()) {
        parts.push(sessionNotes.trim());
      } else {
        parts.push('- ');
      }
      parts.push('');

      finalContent = parts.join('\n');
    }

    let finalTitle = title.trim();
    if (articleType === 'session') {
      const sWorld = (selectedWorlds.length > 0 ? selectedWorlds[0] : '').toUpperCase().trim();
      if (sessionDate.trim() && sWorld) {
        finalTitle = `${sessionDate.trim()} ${sWorld}`;
      } else if (sessionDate.trim()) {
        finalTitle = sessionDate.trim();
      }
    }

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: finalTitle,
          date: articleType === 'session' ? (sessionDate || undefined) : undefined,
          image: image.trim() || undefined,
          guildCharacterId: guildCharacterId || undefined,
          content: finalContent,
          worlds: articleType === 'meta' ? [] : selectedWorlds,
          tags: Array.from(new Set(finalTags)),
          existingFilePath,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save note');
      }

      const data = await res.json();
      router.push(`/notes/${data.slug}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !user) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-red-950/20 border border-red-800/40 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Access Denied</h2>
        <p className="text-xs text-red-300">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border rounded-lg text-xs font-semibold text-white"
        >
          Return to Wiki
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-obsidian-border pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 text-obsidian-textMuted hover:text-white hover:bg-obsidian-card rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {editSlug ? 'Edit Article' : 'New Article'}
            </h1>
            <p className="text-xs text-obsidian-textFaint">
              {editSlug ? 'Update knowledge base document' : 'Contribute new lore, location, faction, or campaign note'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition-colors ${
              previewMode
                ? 'bg-obsidian-purple text-white border-obsidian-purple'
                : 'bg-obsidian-card border-obsidian-border text-obsidian-text hover:bg-obsidian-hover'
            }`}
          >
            {previewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{previewMode ? 'Back to Editor' : 'Preview'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-obsidian-purple hover:bg-obsidian-purpleHover disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md flex items-center space-x-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save & Publish'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-lg text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Metadata Configuration */}
      <div className="p-5 bg-obsidian-surface border border-obsidian-border rounded-xl space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-1.5 flex items-center justify-between">
            <span>Title</span>
            {articleType === 'session' && (
              <span className="text-[11px] font-mono text-purple-300 flex items-center space-x-1">
                <Lock className="w-3 h-3 text-obsidian-textFaint" />
                <span>Standardized (YYYY-MM-DD WORLDNAME)</span>
              </span>
            )}
          </label>
          {articleType === 'session' ? (
            <div className="w-full bg-obsidian-card/60 border border-obsidian-border rounded-lg px-3 py-2 text-base font-semibold text-white font-mono flex items-center justify-between">
              <span>{title}</span>
              <span className="text-xs font-normal text-obsidian-textFaint">Locked</span>
            </div>
          ) : (
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. City State of Greater Kalogeron"
              className="w-full bg-obsidian-card border border-obsidian-border rounded-lg px-3 py-2 text-base font-semibold text-white focus:outline-none focus:border-obsidian-purple"
            />
          )}
        </div>

        {/* What is this? Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-2">
            What is this?
          </label>

          {isExistingSession ? (
            <div className="p-3.5 bg-purple-950/20 border border-purple-800/40 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Calendar className="w-4 h-4 text-purple-300" />
                <div>
                  <div className="text-sm font-semibold text-white">Session Report</div>
                  <div className="text-xs text-obsidian-textMuted">Synchronized with Guild API expedition record</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono text-purple-300">
                <Lock className="w-3.5 h-3.5 text-obsidian-textFaint" />
                <span>Session Type</span>
              </div>
            </div>
          ) : isExistingCharacter ? (
            <div className="p-3.5 bg-blue-950/20 border border-blue-800/40 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <User className="w-4 h-4 text-blue-300" />
                <div>
                  <div className="text-sm font-semibold text-white">Player Character Dossier</div>
                  <div className="text-xs text-obsidian-textMuted">
                    Synchronized with Guild API {existingMetadata?.class && `(${existingMetadata.ancestry} ${existingMetadata.class})`}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono text-blue-300">
                <Lock className="w-3.5 h-3.5 text-obsidian-textFaint" />
                <span>Character Type</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setArticleType('location')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'location'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  <span className="font-semibold text-sm">Location</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Place, landmark, wilderness, or region
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('npc')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'npc'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-sm">NPC</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Characters in story, not played by players
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('organization')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'organization'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Flag className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-sm">Organization</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Factions, councils, guilds, or groups
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('event')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'event'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-sm">Event</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Historical or upcoming campaign event
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('species')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'species'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-sm">Species</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Creature or playable ancestry species
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('meta')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'meta'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <BookOpen className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-sm">Campaign Guide</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Rules &amp; guidelines (saved in _META)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('other')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'other'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <MoreHorizontal className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-sm">Other</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Languages, deities, items, artifacts, etc.
                </p>
              </button>
            </div>
          )}

          {/* Other Custom Primary Tag Input with Fuzzy Search */}
          {articleType === 'other' && (
            <div className="mt-3 p-3 bg-obsidian-card/50 border border-obsidian-border rounded-lg space-y-2">
              <label className="block text-xs font-semibold text-white">
                Primary Tag (e.g. <span className="font-mono text-obsidian-purpleLight">#language</span>, <span className="font-mono text-obsidian-purpleLight">#item</span>, <span className="font-mono text-obsidian-purpleLight">#deity</span>)
              </label>

              {/* Current Selected Tag Pill */}
              {otherTag && (
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-obsidian-purple text-white text-xs font-mono font-medium shadow-sm">
                    <span>#{otherTag.replace(/^#/, '')}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtherTag('');
                        setOtherTagSearch('');
                      }}
                      className="hover:text-red-300 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}

              {/* Fuzzy Search Box & Dropdown */}
              <div className="relative w-full sm:w-80">
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-obsidian-textFaint text-xs font-mono">#</span>
                  <input
                    type="text"
                    value={otherTagSearch}
                    onChange={e => {
                      setOtherTagSearch(e.target.value);
                      setShowOtherTagDropdown(true);
                    }}
                    onFocus={() => setShowOtherTagDropdown(true)}
                    placeholder="Search existing tags or type new..."
                    className="w-full bg-obsidian-surface border border-obsidian-border rounded-lg pl-7 pr-8 py-1.5 text-xs text-white font-mono placeholder-obsidian-textFaint focus:outline-none focus:border-obsidian-purple"
                  />
                  {otherTagSearch && (
                    <button
                      type="button"
                      onClick={() => setOtherTagSearch('')}
                      className="absolute right-2.5 text-obsidian-textFaint hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown list */}
                {showOtherTagDropdown && (
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-obsidian-surface border border-obsidian-border rounded-xl shadow-xl p-1.5 space-y-1">
                    {/* Create New Tag Option */}
                    {otherTagSearch.trim() && !allExistingTags.some(t => t.tag.toLowerCase() === otherTagSearch.replace(/^#/, '').toLowerCase().trim()) && (
                      <button
                        type="button"
                        onClick={() => {
                          const clean = otherTagSearch.replace(/^#/, '').toLowerCase().trim();
                          setOtherTag(clean);
                          setOtherTagSearch('');
                          setShowOtherTagDropdown(false);
                        }}
                        className="w-full px-2.5 py-1.5 text-left rounded-lg bg-obsidian-purpleFaint hover:bg-obsidian-purple border border-obsidian-purpleBorder text-xs text-white flex items-center justify-between group transition-colors cursor-pointer"
                      >
                        <span className="flex items-center space-x-1.5 font-mono">
                          <Plus className="w-3 h-3 text-emerald-400 group-hover:text-white" />
                          <span>Create new tag: <strong>#{otherTagSearch.replace(/^#/, '').toLowerCase().trim()}</strong></span>
                        </span>
                        <span className="text-[10px] text-obsidian-purpleLight group-hover:text-purple-200">New</span>
                      </button>
                    )}

                    {/* Filtered Existing Tags */}
                    {allExistingTags
                      .filter(t => t.tag.toLowerCase().includes(otherTagSearch.replace(/^#/, '').toLowerCase().trim()))
                      .slice(0, 15)
                      .map(t => {
                        const isCurrent = otherTag.replace(/^#/, '').toLowerCase() === t.tag.toLowerCase();
                        return (
                          <button
                            key={t.tag}
                            type="button"
                            onClick={() => {
                              setOtherTag(t.tag);
                              setOtherTagSearch('');
                              setShowOtherTagDropdown(false);
                            }}
                            className={`w-full px-2.5 py-1.5 text-left rounded-lg text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-obsidian-purple text-white font-semibold'
                                : 'text-zinc-300 hover:bg-obsidian-card hover:text-white'
                            }`}
                          >
                            <span>#{t.tag}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-obsidian-surface border border-obsidian-borderSubtle text-obsidian-textFaint">
                              {t.count}
                            </span>
                          </button>
                        );
                      })}

                    {allExistingTags.filter(t => t.tag.toLowerCase().includes(otherTagSearch.replace(/^#/, '').toLowerCase().trim())).length === 0 && !otherTagSearch.trim() && (
                      <div className="py-3 text-center text-xs text-obsidian-textFaint italic">
                        Type to search or create a tag
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Location Sub-tag (Settlement) */}
          {articleType === 'location' && (
            <div className="mt-3 p-3 bg-obsidian-card/50 border border-obsidian-border rounded-lg flex items-center space-x-2.5">
              <input
                type="checkbox"
                id="settlementCheckbox"
                checked={isSettlement}
                onChange={e => setIsSettlement(e.target.checked)}
                className="rounded border-obsidian-border text-obsidian-purple focus:ring-0 focus:outline-none w-4 h-4 bg-obsidian-surface cursor-pointer"
              />
              <label htmlFor="settlementCheckbox" className="text-xs text-white font-medium cursor-pointer select-none">
                Settlement (Inhabited by people — adds <span className="font-mono text-obsidian-purpleLight">#location/settlement</span>)
              </label>
            </div>
          )}
        </div>

        {/* Session Date (Only for session reports) */}
        {articleType === 'session' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-1.5">
              Session Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={e => setSessionDate(e.target.value)}
              className="w-full sm:w-64 bg-obsidian-card border border-obsidian-border rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-obsidian-purple"
            />
          </div>
        )}

        {/* Character Image */}
        {articleType === 'pc' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-1.5">
              Character Image
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Preview thumbnail or Placeholder */}
              {image ? (
                <div className="flex items-center space-x-3 p-2 bg-obsidian-surface border border-obsidian-border rounded-xl">
                  <img
                    src={`/api/attachments/${encodeURIComponent(image)}`}
                    alt={image}
                    className="w-12 h-12 rounded-lg object-cover border border-obsidian-borderSubtle bg-obsidian-card shrink-0"
                    onError={e => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="min-w-0 pr-2">
                    <span className="block text-xs font-semibold text-white truncate max-w-[200px]" title={image}>
                      {image}
                    </span>
                    <span className="text-[10px] text-obsidian-purpleLight font-mono">
                      Selected Character Portrait
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors p-1"
                    title="Remove Image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-xs text-obsidian-textFaint italic">
                  <span>No image selected for this character.</span>
                </div>
              )}

              {/* Action Buttons: Browse and Upload */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openImageBrowser}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border hover:border-obsidian-purple text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-obsidian-purpleLight" />
                  <span>Browse Images</span>
                </button>

                <label className="inline-flex items-center space-x-1.5 px-3 py-2 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border hover:border-obsidian-purple text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer shadow-sm">
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingImage}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleCharacterImageUpload(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <p className="text-[11px] text-obsidian-textFaint mt-1.5">
              Displays as the character avatar portrait in the roster and dossiers. Stored in <code>_META/_attachments/</code>.
            </p>
          </div>
        )}

        {/* Linked Worlds (Rules / guides are not linked to worlds) */}
        {articleType !== 'meta' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-2">
              Linked Worlds (select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {KNOWN_WORLDS.map(w => {
                const selected = selectedWorlds.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWorld(w)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
                      selected
                        ? 'bg-obsidian-purple text-white border-obsidian-purple shadow-sm'
                        : 'bg-obsidian-card border-obsidian-border text-obsidian-textMuted hover:text-white hover:border-obsidian-purpleBorder'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>{w}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Additional Custom Sub-tags with Fuzzy Search */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint">
            Additional Sub-Tags (Optional)
          </label>

          {/* Active Sub-Tag Pills */}
          {extraTagsStr.trim() && (
            <div className="flex flex-wrap gap-1.5">
              {extraTagsStr
                .split(',')
                .map(t => t.replace(/^#/, '').toLowerCase().trim())
                .filter(Boolean)
                .map(tagItem => (
                  <span
                    key={tagItem}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-obsidian-surface border border-obsidian-purpleBorder text-purple-200 text-xs font-mono font-medium shadow-sm"
                  >
                    <span>#{tagItem}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const current = extraTagsStr
                          .split(',')
                          .map(t => t.replace(/^#/, '').toLowerCase().trim())
                          .filter(Boolean);
                        const updated = current.filter(t => t !== tagItem);
                        setExtraTagsStr(updated.join(', '));
                      }}
                      className="text-obsidian-textFaint hover:text-red-300 ml-1 transition-colors cursor-pointer"
                      title="Remove tag"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
            </div>
          )}

          {/* Search / Input with Fuzzy Dropdown */}
          <div className="relative w-full sm:w-96">
            <div className="relative flex items-center">
              <span className="absolute left-3 text-obsidian-textFaint text-xs font-mono">#</span>
              <input
                type="text"
                value={subTagInput}
                onChange={e => {
                  setSubTagInput(e.target.value);
                  setShowSubTagDropdown(true);
                }}
                onFocus={() => setShowSubTagDropdown(true)}
                placeholder="Search existing tags or type new tag..."
                className="w-full bg-obsidian-card border border-obsidian-border rounded-lg pl-7 pr-8 py-2 text-xs text-white font-mono placeholder-obsidian-textFaint focus:outline-none focus:border-obsidian-purple"
              />
              {subTagInput && (
                <button
                  type="button"
                  onClick={() => setSubTagInput('')}
                  className="absolute right-2.5 text-obsidian-textFaint hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown list */}
            {showSubTagDropdown && (
              <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-obsidian-surface border border-obsidian-border rounded-xl shadow-xl p-1.5 space-y-1">
                {/* Create New Tag Option */}
                {subTagInput.trim() &&
                  !allExistingTags.some(t => t.tag.toLowerCase() === subTagInput.replace(/^#/, '').toLowerCase().trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        const clean = subTagInput.replace(/^#/, '').toLowerCase().trim();
                        const current = extraTagsStr
                          .split(',')
                          .map(t => t.replace(/^#/, '').toLowerCase().trim())
                          .filter(Boolean);
                        if (!current.includes(clean)) {
                          current.push(clean);
                          setExtraTagsStr(current.join(', '));
                        }
                        setSubTagInput('');
                        setShowSubTagDropdown(false);
                      }}
                      className="w-full px-2.5 py-1.5 text-left rounded-lg bg-obsidian-purpleFaint hover:bg-obsidian-purple border border-obsidian-purpleBorder text-xs text-white flex items-center justify-between group transition-colors cursor-pointer"
                    >
                      <span className="flex items-center space-x-1.5 font-mono">
                        <Plus className="w-3 h-3 text-emerald-400 group-hover:text-white" />
                        <span>Create new tag: <strong>#{subTagInput.replace(/^#/, '').toLowerCase().trim()}</strong></span>
                      </span>
                      <span className="text-[10px] text-obsidian-purpleLight group-hover:text-purple-200">New</span>
                    </button>
                  )}

                {/* Filtered Existing Tags */}
                {allExistingTags
                  .filter(t => {
                    const search = subTagInput.replace(/^#/, '').toLowerCase().trim();
                    const current = extraTagsStr
                      .split(',')
                      .map(x => x.replace(/^#/, '').toLowerCase().trim())
                      .filter(Boolean);
                    // Filter by search string
                    if (search && !t.tag.toLowerCase().includes(search)) return false;
                    // Don't show system tags
                    if (['location', 'npc', 'organization', 'event', 'species', 'meta', 'session', 'pc', 'world'].includes(t.tag)) return false;
                    return true;
                  })
                  .slice(0, 15)
                  .map(t => {
                    const current = extraTagsStr
                      .split(',')
                      .map(x => x.replace(/^#/, '').toLowerCase().trim())
                      .filter(Boolean);
                    const isSelected = current.includes(t.tag);

                    return (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            const updated = current.filter(x => x !== t.tag);
                            setExtraTagsStr(updated.join(', '));
                          } else {
                            current.push(t.tag);
                            setExtraTagsStr(current.join(', '));
                          }
                          setSubTagInput('');
                          setShowSubTagDropdown(false);
                        }}
                        className={`w-full px-2.5 py-1.5 text-left rounded-lg text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-obsidian-purple text-white font-semibold'
                            : 'text-zinc-300 hover:bg-obsidian-card hover:text-white'
                        }`}
                      >
                        <span className="flex items-center space-x-2">
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                          <span>#{t.tag}</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-obsidian-surface border border-obsidian-borderSubtle text-obsidian-textFaint">
                          {t.count}
                        </span>
                      </button>
                    );
                  })}

                {allExistingTags.filter(t => t.tag.toLowerCase().includes(subTagInput.replace(/^#/, '').toLowerCase().trim())).length === 0 && !subTagInput.trim() && (
                  <div className="py-3 text-center text-xs text-obsidian-textFaint italic">
                    Type to search or create a tag
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-[11px] text-obsidian-textFaint">
            Pick from already-used tags in the campaign, or type a name to create a new tag.
          </p>
        </div>

        {/* Automated Authors Indicator */}
        <div className="p-3 bg-obsidian-card/40 border border-obsidian-borderSubtle rounded-lg flex items-center justify-between text-xs text-obsidian-textMuted">
          <div className="flex items-center space-x-2">
            <User className="w-3.5 h-3.5 text-obsidian-textFaint" />
            <span>
              Authoring: <strong className="text-white">{user?.name || user?.nickname || 'Your Account'}</strong> will be recorded automatically.
            </span>
          </div>
          <span className="text-[11px] text-obsidian-textFaint font-mono">Automated Version Tracking</span>
        </div>
      </div>

      {/* Editor & Preview Area */}
      <div className="space-y-2">
        {/* Markdown Toolbar */}
        {!previewMode && (
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-obsidian-surface border border-obsidian-border rounded-lg text-xs text-obsidian-textMuted">
            <button
              type="button"
              onClick={() => insertText('## ')}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border"
              title="Heading 2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => insertText('### ')}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border"
              title="Heading 3"
            >
              H3
            </button>
            <button
              type="button"
              onClick={() => insertText('**', '**')}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border font-bold"
              title="Bold"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => insertText('*', '*')}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border italic"
              title="Italic"
            >
              I
            </button>
            <button
              type="button"
              onClick={insertUnnumberedList}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border flex items-center space-x-1"
              title="Bullet List (Ctrl/Cmd+Enter / Tab)"
            >
              <List className="w-3.5 h-3.5 text-obsidian-purpleLight" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={outdentLines}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border flex items-center space-x-1"
              title="Decrease Indent (Shift+Tab)"
            >
              <Outdent className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={indentLines}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border flex items-center space-x-1"
              title="Increase Indent (Tab)"
            >
              <Indent className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={insertMarkdownTable}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border flex items-center space-x-1"
              title="Insert Markdown Table (Tab/Enter to navigate & auto-format)"
            >
              <Table className="w-3.5 h-3.5 text-obsidian-purpleLight" />
              <span>Table</span>
            </button>

            <button
              type="button"
              onClick={openWikilinkModal}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border flex items-center space-x-1"
              title="Search & Link Article"
            >
              <LinkIcon className="w-3 h-3 text-obsidian-purpleLight" />
              <span>Wikilink</span>
            </button>

            {/* Obsidian Callouts dropdown */}
            <select
              onChange={e => {
                const val = e.target.value;
                if (!val) return;
                insertText(`> [!${val}]\n> `);
                e.target.value = '';
              }}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover text-obsidian-text rounded border border-obsidian-border text-xs focus:outline-none"
              defaultValue=""
            >
              <option value="" disabled>+ Callout...</option>
              <option value="abstract">Abstract</option>
              <option value="note">Note</option>
              <option value="info">Info</option>
              <option value="tip">Tip</option>
              <option value="question">Question</option>
              <option value="warning">Warning</option>
              <option value="quote">Quote</option>
            </select>

            <label className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border flex items-center space-x-1 cursor-pointer">
              <ImageIcon className="w-3 h-3" />
              <span>Upload Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        )}

        {previewMode ? (
          <div className="p-6 bg-obsidian-surface border border-obsidian-border rounded-xl min-h-[500px]">
            {articleType === 'session' ? (
              <div className="space-y-6">
                {/* Session Abstract Preview */}
                <div className="p-5 rounded-2xl bg-blue-950/25 border border-blue-800/50 space-y-2">
                  <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-blue-300">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Abstract</span>
                  </div>
                  {sessionAbstract.trim() ? (
                    <div
                      className="prose max-w-none text-blue-100/90 leading-relaxed font-sans text-sm"
                      dangerouslySetInnerHTML={{ __html: marked.parse(sessionAbstract) as string }}
                    />
                  ) : (
                    <p className="text-xs text-blue-300/60 italic">No abstract entered yet.</p>
                  )}
                </div>

                {/* Session Notes Preview */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-obsidian-textFaint">
                    <FilePenLine className="w-3.5 h-3.5 text-obsidian-purpleLight" />
                    <span>Notes</span>
                  </div>
                  <div className="p-6 bg-obsidian-surface/60 border border-obsidian-border rounded-2xl">
                    {sessionNotes.trim() ? (
                      <div
                        className="prose max-w-none text-zinc-300 leading-relaxed font-sans"
                        dangerouslySetInnerHTML={{ __html: marked.parse(sessionNotes) as string }}
                      />
                    ) : (
                      <p className="text-xs text-obsidian-textFaint italic">No session notes entered yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="prose max-w-none text-zinc-300 leading-relaxed font-sans">
                <div dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }} />
              </div>
            )}
          </div>
        ) : articleType === 'session' ? (
          <div className="space-y-5">
            {/* 1. Abstract Field (Blue Styled Container) */}
            <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-blue-300">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Abstract</span>
                </label>
                <span className="text-[11px] text-blue-300/70 font-mono">
                  High-level summary / executive briefing
                </span>
              </div>
              <textarea
                ref={abstractTextareaRef}
                value={sessionAbstract}
                onChange={e => setSessionAbstract(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                onFocus={() => {
                  activeFieldRef.current = 'abstract';
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                placeholder="Write a concise executive summary or debrief of what transpired in this session..."
                className="w-full h-36 bg-blue-950/30 border border-blue-800/50 rounded-lg p-3.5 text-sm font-sans text-blue-100 placeholder-blue-300/40 focus:outline-none focus:border-blue-500 leading-relaxed resize-y"
              />
            </div>

            {/* 2. Notes Field (Clean Markdown Field) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-obsidian-textFaint">
                  <FilePenLine className="w-3.5 h-3.5 text-obsidian-purpleLight" />
                  <span>Notes</span>
                </label>
                <span className="text-[11px] text-obsidian-textFaint">
                  Detailed chronology, NPC encounters, dialogue, and secrets
                </span>
              </div>
              <textarea
                ref={notesTextareaRef}
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                onFocus={() => {
                  activeFieldRef.current = 'notes';
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                placeholder="Detailed session notes, bullet points, events, discoveries, and combat logs..."
                className="w-full h-96 bg-obsidian-surface border border-obsidian-border rounded-xl p-4 text-sm font-mono text-white focus:outline-none focus:border-obsidian-purple leading-relaxed resize-y"
              />
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            onFocus={() => {
              activeFieldRef.current = 'content';
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            placeholder="Write markdown here... Supports Obsidian callouts (> [!note]), image embeds (![[image.png]]), and wikilinks ([[Note Title]])."
            className="w-full h-[550px] bg-obsidian-surface border border-obsidian-border rounded-xl p-4 text-sm font-mono text-white focus:outline-none focus:border-obsidian-purple leading-relaxed resize-y"
          />
        )}
      </div>

      {/* Image Browser / Gallery Modal */}
      {showImageBrowser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-obsidian-border flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-4 h-4 text-obsidian-purpleLight" />
                <h3 className="font-bold text-sm text-white">Browse Uploaded Images</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImageBrowser(false)}
                className="p-1 rounded-lg text-obsidian-textFaint hover:text-white hover:bg-obsidian-card transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Toolbar: Search & Quick Upload */}
            <div className="p-4 border-b border-obsidian-borderSubtle bg-obsidian-card/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-obsidian-textFaint absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={imageSearch}
                  onChange={e => setImageSearch(e.target.value)}
                  placeholder="Search uploaded images..."
                  className="w-full bg-obsidian-surface border border-obsidian-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-obsidian-textFaint focus:outline-none focus:border-obsidian-purple"
                />
              </div>

              <label className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-obsidian-purple hover:bg-obsidian-purpleLight text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 shadow-sm">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingImage ? 'Uploading...' : 'Upload New'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage}
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleCharacterImageUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Image Gallery Grid */}
            <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
              {loadingImages ? (
                <div className="py-20 text-center text-xs text-obsidian-textFaint">
                  Loading images from vault...
                </div>
              ) : availableImages.length === 0 ? (
                <div className="py-20 text-center space-y-2">
                  <p className="text-xs text-obsidian-textFaint">No uploaded images found in _META/_attachments.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {availableImages
                    .filter(img => img.filename.toLowerCase().includes(imageSearch.toLowerCase()))
                    .map(img => {
                      const isSelected = image === img.filename;
                      return (
                        <button
                          key={img.filename}
                          type="button"
                          onClick={() => {
                            setImage(img.filename);
                            setShowImageBrowser(false);
                          }}
                          className={`group relative p-2 rounded-xl border text-left flex flex-col items-center justify-between transition-all aspect-square overflow-hidden cursor-pointer ${
                            isSelected
                              ? 'bg-obsidian-purpleFaint border-obsidian-purple ring-2 ring-obsidian-purple'
                              : 'bg-obsidian-card/60 border-obsidian-border hover:border-obsidian-purple hover:bg-obsidian-card'
                          }`}
                        >
                          <div className="w-full h-24 sm:h-28 rounded-lg overflow-hidden bg-obsidian-surface border border-obsidian-borderSubtle flex items-center justify-center">
                            <img
                              src={img.url}
                              alt={img.filename}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                            />
                          </div>
                          <span
                            className="w-full text-[11px] font-medium text-obsidian-textMuted group-hover:text-white truncate text-center mt-2 px-1"
                            title={img.filename}
                          >
                            {img.filename}
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-obsidian-border bg-obsidian-card/40 flex justify-end">
              <button
                type="button"
                onClick={() => setShowImageBrowser(false)}
                className="px-4 py-1.5 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border rounded-lg text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wikilink Search & Insert Modal */}
      {showWikilinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-obsidian-border flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <LinkIcon className="w-4 h-4 text-obsidian-purpleLight" />
                <h3 className="font-bold text-sm text-white">Insert Wikilink</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWikilinkModal(false)}
                className="p-1 rounded-lg text-obsidian-textFaint hover:text-white hover:bg-obsidian-card transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Search & Custom Display Text */}
            <div className="p-4 border-b border-obsidian-borderSubtle bg-obsidian-card/40 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-obsidian-textFaint absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={wikilinkSearch}
                  onChange={e => {
                    setWikilinkSearch(e.target.value);
                    searchArticles(e.target.value);
                  }}
                  placeholder="Search articles by title, world (@zenith), or tag (#npc)..."
                  className="w-full bg-obsidian-surface border border-obsidian-border rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-obsidian-textFaint focus:outline-none focus:border-obsidian-purple font-medium"
                />
                {wikilinkSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setWikilinkSearch('');
                      searchArticles('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-obsidian-textFaint hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Optional Custom Alias */}
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-obsidian-textFaint shrink-0">Custom display text:</span>
                <input
                  type="text"
                  value={wikilinkCustomAlias}
                  onChange={e => setWikilinkCustomAlias(e.target.value)}
                  placeholder="Leave empty to use article title"
                  className="flex-1 bg-obsidian-surface border border-obsidian-borderSubtle rounded-md px-2.5 py-1 text-xs text-white placeholder-obsidian-textFaint focus:outline-none focus:border-obsidian-purple font-mono"
                />
              </div>
            </div>

            {/* Search Results List */}
            <div className="flex-1 overflow-y-auto p-3 min-h-[250px] space-y-1.5">
              {/* Quick option to link exactly what's typed if not found */}
              {wikilinkSearch.trim() && (
                <button
                  type="button"
                  onClick={() => insertWikilink(wikilinkSearch)}
                  className="w-full p-2.5 rounded-xl bg-obsidian-purpleFaint/70 hover:bg-obsidian-purple border border-obsidian-purpleBorder text-left flex items-center justify-between group transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <Plus className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white shrink-0" />
                    <span className="text-xs text-white font-mono truncate">
                      Link verbatim: <strong>[[{wikilinkSearch.trim()}{wikilinkCustomAlias && wikilinkCustomAlias.trim() !== wikilinkSearch.trim() ? `|${wikilinkCustomAlias.trim()}` : ''}]]</strong>
                    </span>
                  </div>
                  <span className="text-[10px] text-obsidian-purpleLight group-hover:text-purple-200 uppercase font-mono tracking-wider shrink-0 ml-2">
                    Custom Link
                  </span>
                </button>
              )}

              {loadingWikilinks ? (
                <div className="py-16 text-center text-xs text-obsidian-textFaint">
                  Searching wiki articles...
                </div>
              ) : wikilinkResults.length === 0 ? (
                <div className="py-16 text-center space-y-1">
                  <p className="text-xs text-obsidian-textFaint">No matching articles found in the wiki.</p>
                  <p className="text-[11px] text-obsidian-textMuted">You can still click the custom link above to create an unresolved wikilink.</p>
                </div>
              ) : (
                wikilinkResults.map(res => (
                  <button
                    key={res.slug}
                    type="button"
                    onClick={() => insertWikilink(res.title)}
                    className="w-full p-3 rounded-xl bg-obsidian-card/60 hover:bg-obsidian-card border border-obsidian-border hover:border-obsidian-purple transition-all text-left flex items-start justify-between gap-3 group cursor-pointer"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-white group-hover:text-obsidian-purpleLight transition-colors truncate">
                          {res.title}
                        </span>
                        {res.category && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-obsidian-surface border border-obsidian-borderSubtle text-obsidian-textFaint font-mono capitalize shrink-0">
                            {res.category}
                          </span>
                        )}
                      </div>

                      {res.abstract && (
                        <p className="text-[11px] text-obsidian-textMuted line-clamp-1 leading-snug">
                          {res.abstract.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')}
                        </p>
                      )}

                      {/* Badges: Worlds and tags */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {res.worlds?.map(w => (
                          <span key={w} className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40 font-mono">
                            {w}
                          </span>
                        ))}
                        {res.tags?.slice(0, 3).map(t => (
                          <span key={t} className="text-[9px] px-1.5 py-0.2 rounded bg-obsidian-surface text-obsidian-textFaint font-mono">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 text-right pt-0.5">
                      <span className="text-[11px] font-mono text-obsidian-purpleLight group-hover:underline">
                        Select
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-obsidian-border bg-obsidian-card/40 flex justify-end">
              <button
                type="button"
                onClick={() => setShowWikilinkModal(false)}
                className="px-4 py-1.5 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
