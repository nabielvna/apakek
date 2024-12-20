"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Image as ImageIcon, Type as TextIcon, Grip, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Image from 'next/image';
import RichTextEditor from '@/components/tiptap/rich-text-editor';
import { getSubCategories } from '@/actions/subcategory';
import { createNews } from "@/actions/news";
import { getCurrentUserData } from "@/actions/user";
import { uploadImage, moveToPublic } from "@/actions/upload";
import { SubCategory } from '@/types';
import NewsImageUploadField from '@/components/news-image-upload';

type TextContent = {
  text: string;
};

type ImageContent = {
  imageUrl: string;
  alt: string;
  description: string;
};

type Section = {
  id: string;
  order: number;
  title: string | null;
  isSeparator: boolean;
  content: {
    type: 'text' | 'image';
    data: TextContent | ImageContent;
  };
};

interface TempFile {
  tempPath: string;
  filename: string;
}

interface EditorViewProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  thumbnailUrl: string;
  handleThumbnailUpload: (value: string | File) => Promise<void>;
  subCategoryId: string;
  setSubCategoryId: (value: string) => void;
  subCategories: SubCategory[];
  isLoadingSubCategories: boolean;
  sections: Section[];
  setSections: (sections: Section[]) => void;
  isDragging: boolean;
  draggedIndex: number | null;
  handleDragStart: (index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  addSection: (type: 'text' | 'image') => void;
  updateSection: (index: number, data: Partial<Section>) => void;
  removeSection: (index: number) => void;
  handleSectionImageUpload: (index: number, value: string | File) => Promise<void>;
}

interface PreviewViewProps {
  title: string;
  description: string;
  thumbnailUrl: string;
  sections: Section[];
}

const EditorView = ({
  title,
  setTitle,
  description,
  setDescription,
  thumbnailUrl,
  handleThumbnailUpload,
  subCategoryId,
  setSubCategoryId,
  subCategories,
  isLoadingSubCategories,
  sections,
  setSections,
  isDragging,
  draggedIndex,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  addSection,
  updateSection,
  removeSection,
  handleSectionImageUpload,
}: EditorViewProps) => (
  <div className="space-y-8">
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="title" className="font-medium">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter news title"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description" className="font-medium">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter news description"
              className="mt-1"
            />
          </div>

          <div>
            <NewsImageUploadField
              value={thumbnailUrl}
              onUploadComplete={handleThumbnailUpload}
              label="Thumbnail Image"
            />
          </div>

          <div>
            <Label htmlFor="subcategory" className="font-medium">Sub Category</Label>
            <Select value={subCategoryId} onValueChange={setSubCategoryId} disabled={isLoadingSubCategories}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={isLoadingSubCategories ? "Loading..." : "Select a sub category"} />
              </SelectTrigger>
              <SelectContent>
                {subCategories.map((subCategory) => (
                  <SelectItem key={subCategory.id} value={subCategory.id}>
                    {subCategory.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => addSection('text')} variant="outline">
          <TextIcon className="w-4 h-4 mr-2" />
          Add Text
        </Button>
        <Button onClick={() => addSection('image')} variant="outline">
          <ImageIcon className="w-4 h-4 mr-2" />
          Add Image
        </Button>
        <Button onClick={() => setSections([...sections, {
          id: Math.random().toString(36).substr(2, 9),
          order: sections.length,
          title: null,
          isSeparator: true,
          content: { type: 'text', data: { text: '' } }
        }])} variant="outline">
          Add Separator
        </Button>
      </div>

      <div className="space-y-4">
        {sections.map((section, index) => (
          <Card
            key={section.id}
            className={`${isDragging && draggedIndex === index ? 'opacity-50' : ''}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Grip className="w-4 h-4 cursor-move text-muted-foreground" />
                  <span className="text-sm font-medium">Section {index + 1}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={section.isSeparator}
                    onCheckedChange={(checked) => updateSection(index, { isSeparator: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSection(index)}
                    className="hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {!section.isSeparator && (
                <div className="space-y-4">
                  <div>
                    <Label className="font-medium">Section Title</Label>
                    <Input
                      value={section.title || ''}
                      onChange={(e) => updateSection(index, { title: e.target.value })}
                      placeholder="Enter section title (optional)"
                      className="mt-1"
                    />
                  </div>

                  {section.content.type === 'text' && (
                    <div>
                      <Label className="font-medium">Content</Label>
                      <div className="mt-1">
                        <RichTextEditor
                          content={(section.content.data as TextContent).text}
                          onChange={(newContent) => updateSection(index, {
                            content: {
                              type: 'text',
                              data: { text: newContent }
                            }
                          })}
                          placeholder="Start writing your content..."
                        />
                      </div>
                    </div>
                  )}

                  {section.content.type === 'image' && (
                    <div className="space-y-4">
                      <NewsImageUploadField
                        value={(section.content.data as ImageContent).imageUrl}
                        onUploadComplete={(value) => handleSectionImageUpload(index, value)}
                      />
                      <div>
                        <Label className="font-medium">Alt Text</Label>
                        <Input
                          value={(section.content.data as ImageContent).alt}
                          onChange={(e) => updateSection(index, {
                            content: {
                              type: 'image',
                              data: {
                                ...(section.content.data as ImageContent),
                                alt: e.target.value
                              }
                            }
                          })}
                          placeholder="Alt text"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="font-medium">Image Description</Label>
                        <Input
                          value={(section.content.data as ImageContent).description}
                          onChange={(e) => updateSection(index, {
                            content: {
                              type: 'image',
                              data: {
                                ...(section.content.data as ImageContent),
                                description: e.target.value
                              }
                            }
                          })}
                          placeholder="Image description"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {section.isSeparator && (
                <Separator className="my-4" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </div>
);

const PreviewView = ({
  title,
  description,
  thumbnailUrl,
  sections
}: PreviewViewProps) => (
  <div className="space-y-8">
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Selected Category</span>
          <span>•</span>
          <span>{format(new Date(), 'MMM d, yyyy')}</span>
        </div>
        <h1 className="text-4xl font-bold text-foreground">{title || 'Untitled Article'}</h1>
        <p className="text-xl text-muted-foreground">{description}</p>
      </div>
    </div>

    {thumbnailUrl && (
      <div className="relative h-[400px] w-full overflow-hidden rounded-lg">
        <Image
          src={thumbnailUrl}
          alt={title}
          className="object-cover"
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
    )}

    <div className="space-y-8">
      {sections.map((section) => (
        <div key={section.id}>
          {section.isSeparator ? (
            <Separator className="my-8" />
          ) : (
            <Card className="border-none shadow-none">
              <CardContent className="p-0 space-y-4">
                {section.title && (
                  <h2 className="text-2xl font-semibold text-foreground">{section.title}</h2>
                )}

                {section.content.type === 'text' && (section.content.data as TextContent).text && (
                  <div className="prose prose-zinc dark:prose-invert">
                    <div
                      dangerouslySetInnerHTML={{ __html: (section.content.data as TextContent).text }}
                    />
                  </div>
                )}

                {section.content.type === 'image' && (section.content.data as ImageContent).imageUrl && (
                  <div className="space-y-3">
                    <div className="relative h-[300px] w-full overflow-hidden rounded-lg">
                      <Image
                        src={(section.content.data as ImageContent).imageUrl}
                        alt={(section.content.data as ImageContent).alt || ''}
                        className="object-cover"
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    </div>
                    {(section.content.data as ImageContent).description && (
                      <p className="text-sm text-muted-foreground italic text-center">
                        {(section.content.data as ImageContent).description}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ))}
    </div>
  </div>
);

const CreateNewsPage = () => {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [isLoadingSubCategories, setIsLoadingSubCategories] = useState(true);
  const [sections, setSections] = useState<Section[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('editor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tempFiles, setTempFiles] = useState<{
    [key: string]: TempFile;
  }>({});

  useEffect(() => {
    const fetchSubCategories = async () => {
      try {
        const data = await getSubCategories();
        setSubCategories(data);
      } catch (error: unknown) {
        console.error('Failed to fetch subcategories:', error);
        toast.error('Failed to load subcategories');
      } finally {
        setIsLoadingSubCategories(false);
      }
    };

    fetchSubCategories();
  }, []);

  const handleThumbnailUpload = async (value: string | File) => {
    if (value instanceof File) {
      try {
        const formData = new FormData();
        formData.append('file', value);

        const result = await uploadImage(formData);

        if (!result.success) {
            throw new Error(result.error);
          }

          // Store temp file info
          setTempFiles(prev => ({
            ...prev,
            thumbnail: {
              tempPath: result.tempPath,
              filename: result.filename
            }
          }));

          setThumbnailUrl(result.url);
        } catch (error: unknown) {
          console.error('Failed to upload thumbnail:', error);
          toast.error(error instanceof Error ? error.message : 'Failed to upload thumbnail');
        }
      } else {
        setThumbnailUrl(value);
      }
    };

    const handleSectionImageUpload = async (index: number, value: string | File) => {
      if (value instanceof File) {
        try {
          const formData = new FormData();
          formData.append('file', value);

          const result = await uploadImage(formData);

          if (!result.success) {
            throw new Error(result.error);
          }

          // Store temp file info
          setTempFiles(prev => ({
            ...prev,
            [`section-${index}`]: {
              tempPath: result.tempPath,
              filename: result.filename
            }
          }));

          updateSection(index, {
            content: {
              type: 'image',
              data: {
                ...(sections[index].content.data as ImageContent),
                imageUrl: result.url
              }
            }
          });
        } catch (error: unknown) {
          console.error('Failed to upload image:', error);
          toast.error(error instanceof Error ? error.message : 'Failed to upload image');
        }
      } else {
        updateSection(index, {
          content: {
            type: 'image',
            data: {
              ...(sections[index].content.data as ImageContent),
              imageUrl: value
            }
          }
        });
      }
    };

    const handleSubCategoryChange = (subcategoryId: string) => {
      setSubCategoryId(subcategoryId);
      const selected = subCategories.find(sc => sc.id === subcategoryId);
      setSelectedSubCategory(selected || null);
    };

    const addSection = (type: 'text' | 'image') => {
      const newSection: Section = {
        id: Math.random().toString(36).substr(2, 9),
        order: sections.length,
        title: null,
        isSeparator: false,
        content: {
          type,
          data: type === 'text'
            ? { text: '' }
            : { imageUrl: '', alt: '', description: '' }
        }
      };
      setSections([...sections, newSection]);
    };

    const updateSection = (index: number, data: Partial<Section>) => {
      const newSections = [...sections];
      newSections[index] = { ...newSections[index], ...data };
      setSections(newSections);
    };

    const removeSection = (index: number) => {
      const newSections = sections.filter((_, i) => i !== index);
      setSections(newSections);
    };

    const handleDragStart = (index: number) => {
      setIsDragging(true);
      setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex === null) return;

      const newSections = [...sections];
      const draggedSection = newSections[draggedIndex];
      newSections.splice(draggedIndex, 1);
      newSections.splice(index, 0, draggedSection);
      setSections(newSections);
      setDraggedIndex(index);
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      setDraggedIndex(null);
    };

    const handleSubmit = async () => {
      if (isSubmitting) return;

      // Form validation
      if (!title.trim()) {
        toast.error('Title is required');
        return;
      }

      if (!description.trim()) {
        toast.error('Description is required');
        return;
      }

      if (!subCategoryId) {
        toast.error('Please select a category');
        return;
      }

      if (sections.length === 0) {
        toast.error('Please add at least one section');
        return;
      }

      // Validate sections
      const hasInvalidImage = sections.some(section =>
        section.content.type === 'image' &&
        !(section.content.data as ImageContent).imageUrl
      );

      if (hasInvalidImage) {
        toast.error('Please provide images for all image sections');
        return;
      }

      const hasInvalidText = sections.some(section =>
        section.content.type === 'text' &&
        !(section.content.data as TextContent).text.trim()
      );

      if (hasInvalidText) {
        toast.error('Please provide content for all text sections');
        return;
      }

      setIsSubmitting(true);

      try {
        // Get current user
        const currentUser = await getCurrentUserData();
        if (!currentUser?.id) {
          toast.error('You must be logged in to create news');
          return;
        }

        // Move all temporary files to public
        const movedFiles = await Promise.all(
          Object.entries(tempFiles).map(async ([key, file]) => {
            const publicUrl = await moveToPublic(file.tempPath, file.filename);
            return [key, publicUrl];
          })
        );

        // Convert moved files array to object
        const publicUrls = Object.fromEntries(movedFiles);

        // Update URLs in the news data
        const finalThumbnailUrl = publicUrls['thumbnail']?.replace('/temp-uploads/', '/uploads/') || thumbnailUrl;

        // Update section image URLs
        const finalSections = sections.map((section) => {
            const baseSection = {
              id: section.id,
              order: section.order,
              title: section.title,
              isSeparator: section.isSeparator
            };

            if (section.content.type === 'image') {
              const imageUrl = publicUrls[`section-${section.order}`]?.replace('/temp-uploads/', '/uploads/') ||
                (section.content.data as ImageContent).imageUrl;

              return {
                ...baseSection,
                content: {
                  type: 'image' as const,
                  data: {
                    imageUrl,
                    alt: (section.content.data as ImageContent).alt,
                    description: (section.content.data as ImageContent).description
                  }
                }
              };
            } else {
              return {
                ...baseSection,
                content: {
                  type: 'text' as const,
                  data: {
                    text: (section.content.data as TextContent).text
                  }
                }
              };
            }
          });

        // Prepare news data
        const newsData = {
          title: title.trim(),
          description: description.trim(),
          thumbnailUrl: finalThumbnailUrl.trim() || undefined,
          subCategoryId,
          userId: currentUser.id,
          sections: finalSections
        };

        // Create the news
        const result = await createNews(newsData);

        toast.success('News created successfully!');

        // Construct the full path for navigation
        if (selectedSubCategory && result.path) {
          const categoryPath = selectedSubCategory.category.path;
          const subCategoryPath = selectedSubCategory.path;
          const newsPath = result.path;

          router.push(`/${categoryPath}/${subCategoryPath}/${newsPath}`);
        } else {
          toast.error('Unable to navigate to the created news');
          router.push('/');
        }
      } catch (error: unknown) {
        console.error('Failed to create news:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to create news');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen pt-16">
        <div className="max-w-4xl mx-auto p-6">
          <div className="sticky top-0 z-10 pb-6">
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold text-foreground">Create News</h1>
                <p className="text-muted-foreground">Create a new article with rich content sections</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    'Publish'
                  )}
                </Button>
              </div>
            </div>

            <Tabs defaultValue="editor" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="editor">
                  <EyeOff className="w-4 h-4 mr-2" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsContent value="editor">
                  <EditorView
                    title={title}
                    setTitle={setTitle}
                    description={description}
                    setDescription={setDescription}
                    thumbnailUrl={thumbnailUrl}
                    handleThumbnailUpload={handleThumbnailUpload}
                    subCategoryId={subCategoryId}
                    setSubCategoryId={handleSubCategoryChange}
                    subCategories={subCategories}
                    isLoadingSubCategories={isLoadingSubCategories}
                    sections={sections}
                    setSections={setSections}
                    isDragging={isDragging}
                    draggedIndex={draggedIndex}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDragEnd={handleDragEnd}
                    addSection={addSection}
                    updateSection={updateSection}
                    removeSection={removeSection}
                    handleSectionImageUpload={handleSectionImageUpload}
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <PreviewView
                    title={title}
                    description={description}
                    thumbnailUrl={thumbnailUrl}
                    sections={sections}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    );
  };

  export default CreateNewsPage;
