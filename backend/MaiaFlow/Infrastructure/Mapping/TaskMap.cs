using MaiaFlow.Domain.TaskItem;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MaiaFlow.Infrastructure.Mapping
{
    public class TaskMap : IEntityTypeConfiguration<TaskItem>
    {
        public void Configure(EntityTypeBuilder<TaskItem> builder)
        {
            builder.ToTable("tasks");

            builder.HasKey(t => t.Id);
            builder.Property(t => t.Title).IsRequired().HasMaxLength(150);
            builder.Property(t => t.Description).HasMaxLength(500);
            builder.Property(t => t.DueDate);
            builder.Property(t => t.Status)
                .HasConversion<string>()
                .IsRequired()
                .HasMaxLength(20);
            builder.Property(t => t.UserId).IsRequired();

            builder.HasOne<Domain.User.User>()
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}