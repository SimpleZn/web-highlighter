import { useQuery, useMutation } from "@tanstack/react-query";
import type { HighlightStyle } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Palette, GripVertical, Star, Download, Upload } from "lucide-react";
import { apiRequest, queryClient, exportData } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";

function StyleCard({ style, onDelete }: { style: HighlightStyle; onDelete: () => void }) {
  const { toast } = useToast();

  const toggleDefault = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/styles/${style.id}`, { isDefault: !style.isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/styles"] });
      toast({ title: style.isDefault ? "Removed as default" : "Set as default" });
    },
  });

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-md border border-border bg-card"
      data-testid={`card-style-${style.id}`}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 cursor-grab" />
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-10 h-6 rounded-md border border-border flex-shrink-0"
          style={{ backgroundColor: style.backgroundColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{style.name}</span>
            {style.isDefault && (
              <Star className="w-3 h-3 text-primary fill-primary" />
            )}
          </div>
          <span className="text-xs text-muted-foreground">{style.backgroundColor}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`default-${style.id}`} className="text-xs text-muted-foreground">Default</Label>
          <Switch
            id={`default-${style.id}`}
            checked={style.isDefault ?? false}
            onCheckedChange={() => toggleDefault.mutate()}
            data-testid={`switch-default-${style.id}`}
          />
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          data-testid={`button-delete-style-${style.id}`}
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

function CreateStyleDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    defaultValues: {
      name: "",
      backgroundColor: "#FFF59D",
      color: "#000000",
      borderColor: "#F9A825",
    },
  });

  const createStyle = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/styles", { ...data, isDefault: false, sortOrder: 99 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/styles"] });
      toast({ title: "Style created" });
      setOpen(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Highlight Style</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createStyle.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Important" data-testid="input-style-name" />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="backgroundColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Background Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <input type="color" {...field} className="w-9 h-9 rounded-md border border-border cursor-pointer" data-testid="input-bg-color" />
                        <Input {...field} className="flex-1" />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="borderColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Border Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <input type="color" {...field} className="w-9 h-9 rounded-md border border-border cursor-pointer" data-testid="input-border-color" />
                        <Input {...field} className="flex-1" />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="pt-2">
              <Label className="text-sm text-muted-foreground mb-2 block">Preview</Label>
              <div
                className="px-3 py-2 rounded-md text-sm"
                style={{
                  backgroundColor: form.watch("backgroundColor") + "30",
                  borderLeft: `3px solid ${form.watch("backgroundColor")}`,
                  color: form.watch("color"),
                }}
              >
                This is how your highlight will look on a webpage.
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-style">
                Cancel
              </Button>
              <Button type="submit" disabled={createStyle.isPending || !form.watch("name")} data-testid="button-create-style">
                Create Style
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Settings() {
  const { toast } = useToast();

  const { data: styles, isLoading } = useQuery<HighlightStyle[]>({
    queryKey: ["/api/styles"],
  });

  const deleteStyle = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/styles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/styles"] });
      toast({ title: "Style deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Cannot delete style", description: error.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `highlights-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Data exported successfully" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-settings-title">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your highlight styles and preferences.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Highlight Styles
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Customize the colors used for highlighting text.</p>
          </div>
          <CreateStyleDialog>
            <Button size="sm" data-testid="button-add-style">
              <Plus className="w-4 h-4 mr-1" />
              Add Style
            </Button>
          </CreateStyleDialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : styles?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Palette className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No highlight styles configured.</p>
              <CreateStyleDialog>
                <Button className="mt-4" data-testid="button-add-first-style">
                  <Plus className="w-4 h-4 mr-1" />
                  Add First Style
                </Button>
              </CreateStyleDialog>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {styles?.map((style) => (
              <StyleCard key={style.id} style={style} onDelete={() => deleteStyle.mutate(style.id)} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-medium mb-2">Data Management</h2>
        <p className="text-sm text-muted-foreground mb-4">Export or import your highlights and comments data.</p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExport} data-testid="button-export">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>
    </div>
  );
}
