using MaiaFlow.Domain.Dashboard;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MaiaFlow.Infrastructure.Mapping
{
    public class DashboardMap : IEntityTypeConfiguration<Dashboard>
    {
        public void Configure(EntityTypeBuilder<Dashboard> builder)
        {
            builder.ToTable("dashboards");

            builder.HasKey(d => d.UserId);
            builder.Property(d => d.UserId).HasColumnName("user_id").ValueGeneratedNever();
            builder.Property(d => d.Config).HasColumnName("config").HasColumnType("jsonb");
            builder.Property(d => d.Revision).HasColumnName("revision").IsRequired();
            builder.Property(d => d.UpdatedAt).HasColumnName("updated_at").HasColumnType("timestamp with time zone");

            builder.HasOne<Domain.User.User>()
                .WithOne()
                .HasForeignKey<Dashboard>(d => d.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
